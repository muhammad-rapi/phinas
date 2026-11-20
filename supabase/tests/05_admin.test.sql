begin;
create extension if not exists pgtap with schema extensions;

create schema tests;
create table tests.ids (name text primary key, id uuid not null);
create table tests.codes (label text primary key, code text not null);

-- Creates an auth user; the on_auth_user_created trigger builds the profile.
create function tests.new_user(p_name text, p_invite text default null, p_terms boolean default true)
returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated',
          p_name || '@test.local',
          jsonb_build_object('display_name', p_name, 'invite_code', p_invite, 'accepted_terms', p_terms));
  insert into tests.ids values (p_name, v);
  return v;
end $$;

create function tests.id(p_name text) returns uuid language sql stable
as $$ select id from tests.ids where name = p_name $$;

-- Creates an invite as p_by (bypassing quota) and remembers it under p_label.
create function tests.invite(p_by text, p_label text) returns text language plpgsql security definer as $$
declare c text;
begin
  insert into public.invite_codes (code, created_by)
  values (private.gen_code('', 8), tests.id(p_by)) returning code into c;
  insert into tests.codes values (p_label, c);
  return c;
end $$;

create function tests.code(p_label text) returns text language sql stable
as $$ select code from tests.codes where label = p_label $$;

create function tests.fcode(p_name text) returns text language sql stable security definer
as $$ select friend_code from public.profiles where id = tests.id(p_name) $$;

create function tests.fid(a text, b text) returns uuid language sql stable security definer
as $$ select id from public.friendships
      where user_a = least(tests.id(a), tests.id(b)) and user_b = greatest(tests.id(a), tests.id(b)) $$;

create function tests.befriend(a text, b text) returns void language sql security definer as $$
  insert into public.friendships (user_a, user_b, status, requested_by)
  values (least(tests.id(a), tests.id(b)), greatest(tests.id(a), tests.id(b)), 'accepted', tests.id(a))
$$;

create function tests.pair(a text, b text) returns text language sql stable
as $$ select 'pair:' || least(tests.id(a), tests.id(b)) || ':' || greatest(tests.id(a), tests.id(b)) $$;

-- Sets the JWT claims; follow with `set local role authenticated;`. Undo with `reset role;`.
create function tests.login(p_name text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', tests.id(p_name), 'role', 'authenticated')::text, true)
$$;

grant usage on schema tests to anon, authenticated;
grant select on all tables in schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select * from no_plan();

select tests.new_user('admin');
select tests.new_user('budi', tests.invite('admin', 'b'));

select tests.login('budi');
set local role authenticated;
select throws_ok($$ select public.admin_list_users() $$, 'P0001', 'phinas:not_admin', 'list users: admin only');
select throws_ok($$ select public.admin_list_invites() $$, 'P0001', 'phinas:not_admin', 'list invites: admin only');
select throws_ok($$ select public.admin_set_disabled(tests.id('admin'), true) $$, 'P0001', 'phinas:not_admin',
  'disable: admin only');
select throws_ok($$ select public.admin_set_config('registration_open', 'false') $$, 'P0001', 'phinas:not_admin',
  'config: admin only');
reset role;

-- budi has a live session and refresh token; disabling must end them.
insert into auth.sessions (id, user_id, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000a1', tests.id('budi'), now(), now());
insert into auth.refresh_tokens (instance_id, token, user_id, revoked, session_id)
values ('00000000-0000-0000-0000-000000000000', 'tok-budi', tests.id('budi')::text, false,
        '00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from auth.sessions where user_id = tests.id('budi')), 1, 'budi has a session');

select tests.login('admin');
set local role authenticated;
select is(jsonb_array_length(public.admin_list_users()), 2, 'admin sees every user');
select is((select u->>'email' from jsonb_array_elements(public.admin_list_users()) u where u->>'displayName' = 'budi'),
  'budi@test.local', 'email included');
select is((select u->>'invitedByName' from jsonb_array_elements(public.admin_list_users()) u where u->>'displayName' = 'budi'),
  'admin', 'inviter included');
select is((select (u->>'friendCount')::int from jsonb_array_elements(public.admin_list_users()) u where u->>'displayName' = 'budi'),
  1, 'friend count included');
select is(jsonb_array_length(public.admin_list_invites()), 1, 'admin sees every invite');
select is(public.admin_list_invites()->0->>'createdByName', 'admin', 'invite creator name');
select is(public.admin_list_invites()->0->>'usedByName', 'budi', 'invite user name');
select throws_ok($$ select public.admin_set_disabled(tests.id('admin'), true) $$, 'P0001', 'phinas:self_disable',
  'admin cannot disable themselves');
select lives_ok($$ select public.admin_set_disabled(tests.id('budi'), true) $$, 'disable budi');
select throws_ok($$ select public.admin_set_config('nope', 'true') $$, 'P0001', 'phinas:config_unknown', 'unknown key');
select lives_ok($$ select public.admin_set_config('listen_together_enabled', 'false') $$, 'switch listen off');
reset role;

select ok((select disabled from public.profiles where id = tests.id('budi')), 'budi is disabled');
select is((select count(*)::int from auth.sessions where user_id = tests.id('budi')), 0, 'disabling ends sessions');
select is((select count(*)::int from auth.refresh_tokens where token = 'tok-budi'), 0, 'disabling drops refresh tokens');
select is((select value from public.app_config where key = 'listen_together_enabled'), 'false'::jsonb, 'switch stored');

-- A disabled user still reads their own profile, but cannot act.
select tests.login('budi');
set local role authenticated;
select is((public.my_profile()->>'disabled')::boolean, true, 'disabled user sees the flag');
select throws_ok($$ select public.create_invite() $$, 'P0001', 'phinas:account_disabled', 'disabled user cannot act');
reset role;

-- Delete account cascades.
update public.profiles set disabled = false where id = tests.id('budi');
select tests.login('budi');
set local role authenticated;
select lives_ok($$ select public.delete_my_account() $$, 'delete my account');
reset role;
select is((select count(*)::int from auth.users where id = tests.id('budi')), 0, 'auth user gone');
select is((select count(*)::int from public.profiles where id = tests.id('budi')), 0, 'profile gone');
select is((select count(*)::int from public.friendships), 0, 'friendships gone');

-- A disabled admin is no admin.
select tests.new_user('admin2', tests.invite('admin', 'a2'));
select tests.new_user('cara', tests.invite('admin', 'c'));
update public.profiles set role = 'admin', disabled = true where id = tests.id('admin2');
select tests.login('admin2');
set local role authenticated;
select throws_ok($$ select public.admin_list_users() $$, 'P0001', 'phinas:not_admin', 'disabled admin: list users');
select throws_ok($$ select public.admin_list_invites() $$, 'P0001', 'phinas:not_admin', 'disabled admin: list invites');
select throws_ok($$ select public.admin_set_disabled(tests.id('cara'), true) $$, 'P0001', 'phinas:not_admin',
  'disabled admin: disable');
select throws_ok($$ select public.admin_set_config('registration_open', 'false') $$, 'P0001', 'phinas:not_admin',
  'disabled admin: config');
reset role;

-- No JWT at all.
select set_config('request.jwt.claims', '', true);
set local role authenticated;
select throws_ok($$ select public.admin_list_users() $$, 'P0001', 'phinas:not_admin', 'no jwt: list users');
reset role;

-- A pending request does not count as a friend.
insert into public.friendships (user_a, user_b, status, requested_by)
values (least(tests.id('cara'), tests.id('admin2')), greatest(tests.id('cara'), tests.id('admin2')),
        'pending', tests.id('cara'));

select tests.login('admin');
set local role authenticated;
select is((select (u->>'friendCount')::int from jsonb_array_elements(public.admin_list_users()) u where u->>'displayName' = 'cara'),
  1, 'friend count skips pending');
select is((select (u->>'disabled')::boolean from jsonb_array_elements(public.admin_list_users()) u where u->>'displayName' = 'admin2'),
  true, 'disabled flag listed');
select is((select u->>'invitedById' from jsonb_array_elements(public.admin_list_users()) u where u->>'displayName' = 'cara'),
  tests.id('admin')::text, 'inviter id listed');

-- Config values are type-checked.
select throws_ok($$ select public.admin_set_config('invite_quota', '"abc"') $$, 'P0001', 'phinas:config_invalid',
  'quota: string');
select throws_ok($$ select public.admin_set_config('invite_quota', 'null'::jsonb) $$, 'P0001', 'phinas:config_invalid',
  'quota: json null');
select throws_ok($$ select public.admin_set_config('invite_quota', '3000000000') $$, 'P0001', 'phinas:config_invalid',
  'quota: too big');
select throws_ok($$ select public.admin_set_config('invite_quota', '2.5') $$, 'P0001', 'phinas:config_invalid',
  'quota: fraction');
select throws_ok($$ select public.admin_set_config('invite_quota', '-1') $$, 'P0001', 'phinas:config_invalid',
  'quota: negative');
select throws_ok($$ select public.admin_set_config('listen_together_enabled', '"yes"') $$, 'P0001', 'phinas:config_invalid',
  'switch: string');
select throws_ok($$ select public.admin_set_config('listen_together_enabled', '"true"') $$, 'P0001', 'phinas:config_invalid',
  'switch: quoted true');
select throws_ok($$ select public.admin_set_config('registration_open', '{}') $$, 'P0001', 'phinas:config_invalid',
  'registration: object');
select throws_ok($$ select public.admin_set_config('invite_quota', null) $$, 'P0001', 'phinas:config_invalid',
  'quota: sql null');
select lives_ok($$ select public.admin_set_config('invite_quota', '5') $$, 'quota set to 5');
select lives_ok($$ select public.admin_set_config('listen_together_enabled', 'false') $$, 'switch set off');

-- admin_set_disabled argument checks.
select throws_ok($$ select public.admin_set_disabled(gen_random_uuid(), true) $$, 'P0001', 'phinas:user_not_found',
  'disable: unknown user');
select throws_ok($$ select public.admin_set_disabled(tests.id('cara'), null) $$, 'P0001', 'phinas:invalid_args',
  'disable: null flag');
select throws_ok($$ select public.admin_set_disabled(null, true) $$, 'P0001', 'phinas:invalid_args',
  'disable: null user');
select lives_ok($$ select public.admin_set_disabled(tests.id('admin2'), false) $$, 're-enable admin2');
reset role;
select is((select disabled from public.profiles where id = tests.id('admin2')), false, 'admin2 enabled again');

select tests.login('cara');
set local role authenticated;
select is(public.get_config()->>'inviteQuota', '5', 'quota visible in get_config');
select is(public.get_config()->>'listenTogetherEnabled', 'false', 'switch visible in get_config');
reset role;

-- The table itself rejects a wrongly typed value.
select throws_ok($$ update public.app_config set value = '"abc"' where key = 'invite_quota' $$, '23514', null,
  'check constraint on config values');

-- Admins ignore the invite quota.
update public.app_config set value = '0' where key = 'invite_quota';
select tests.login('admin');
set local role authenticated;
select lives_ok($$ select public.create_invite() $$, 'admin invite 1 with quota 0');
select lives_ok($$ select public.create_invite() $$, 'admin invite 2 with quota 0');
reset role;

select * from finish();
rollback;
