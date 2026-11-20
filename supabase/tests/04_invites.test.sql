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
select is((public.my_profile()->>'invitesLeft')::int, 3, 'three invites to start');
select matches(public.create_invite(), '^[A-Z2-9]{8}$', 'code format');
select lives_ok($$ select public.create_invite() $$, 'second');
select lives_ok($$ select public.create_invite() $$, 'third');
select is((public.my_profile()->>'invitesLeft')::int, 0, 'none left');
select throws_ok($$ select public.create_invite() $$, 'P0001', 'phinas:quota_exceeded', 'quota reached');
select is(jsonb_array_length(public.list_my_invites()), 3, 'list my invites');

select lives_ok($$ select public.revoke_invite(public.list_my_invites()->0->>'code') $$, 'revoke an open code');
select lives_ok($$ select public.create_invite() $$, 'a revoked unused code frees a slot');
select throws_ok($$ select public.revoke_invite('ZZZZZZZZ') $$, 'P0001', 'phinas:invite_invalid', 'unknown code');
reset role;

-- Use one of budi's open codes; used codes keep counting.
select tests.new_user('cici', (
  select code from public.invite_codes
  where created_by = tests.id('budi') and not revoked and used_at is null
  order by created_at limit 1));
select tests.login('budi');
set local role authenticated;
select throws_ok($$ select public.create_invite() $$, 'P0001', 'phinas:quota_exceeded', 'used codes still count');
select throws_ok($$ select public.revoke_invite((select code from public.invite_codes where used_by = tests.id('cici'))) $$,
  'P0001', 'phinas:invite_invalid', 'a used code cannot be revoked');
select is((select i->>'usedByName' from jsonb_array_elements(public.list_my_invites()) i where i->>'usedAt' is not null),
  'cici', 'list shows who used a code');
reset role;

select tests.login('cici');
set local role authenticated;
select is(jsonb_array_length(public.list_my_invites()), 0, 'cici sees only her own codes');
reset role;

-- Admins have no quota.
select tests.login('admin');
set local role authenticated;
select is(public.my_profile()->'invitesLeft', 'null'::jsonb, 'admin has no limit');
select lives_ok($$ select count(public.create_invite()) from generate_series(1, 5) $$, 'admin creates many');
reset role;

-- Quota 0 closes invites for users.
update public.app_config set value = '0' where key = 'invite_quota';
select tests.login('cici');
set local role authenticated;
select throws_ok($$ select public.create_invite() $$, 'P0001', 'phinas:quota_exceeded', 'quota 0');
reset role;

update public.app_config set value = '3' where key = 'invite_quota';

-- Someone else's code cannot be revoked.
insert into tests.codes select 'budi_open', code from public.invite_codes
  where created_by = tests.id('budi') and not revoked and used_at is null order by created_at limit 1;
select tests.login('cici');
set local role authenticated;
select throws_ok($$ select public.revoke_invite(tests.code('budi_open')) $$, 'P0001', 'phinas:invite_invalid',
  'cannot revoke someone else''s code');
reset role;
select is((select revoked from public.invite_codes where code = tests.code('budi_open')), false, 'code untouched');

-- An expired unused code frees a slot.
update public.invite_codes set expires_at = now() - interval '1 minute' where code = tests.code('budi_open');
select tests.login('budi');
set local role authenticated;
select is((public.my_profile()->>'invitesLeft')::int, 1, 'an expired unused code frees a slot');
select lives_ok($$ select public.create_invite() $$, 'budi creates one more');
select is((public.my_profile()->>'invitesLeft')::int, 0, 'quota full again');
reset role;

-- Deleting an account.
select tests.befriend('cici', 'admin');
select tests.login('cici');
set local role authenticated;
select lives_ok($$ select public.delete_my_account() $$, 'cici deletes her account');
reset role;
select ok(not exists (select 1 from public.profiles where id = tests.id('cici')), 'profile gone');
select ok(not exists (select 1 from public.friendships where tests.id('cici') in (user_a, user_b)), 'friendships gone');
select ok(exists (select 1 from public.invite_codes
  where created_by = tests.id('budi') and used_at is not null and used_by is null),
  'the code she used stays used, with no user');
select tests.login('budi');
set local role authenticated;
select is((public.my_profile()->>'invitesLeft')::int, 0, 'the inviter does not get the slot back');
reset role;

select tests.new_user('dedi', tests.invite('admin', 'dd'));
update public.profiles set disabled = true where id = tests.id('dedi');
select tests.login('dedi');
set local role authenticated;
select lives_ok($$ select public.delete_my_account() $$, 'a disabled user can delete their account');
reset role;
select ok(not exists (select 1 from public.profiles where id = tests.id('dedi')), 'disabled user gone');

select tests.login('admin');
set local role authenticated;
select throws_ok($$ select public.delete_my_account() $$, 'P0001', 'phinas:last_admin', 'the last admin cannot leave');
reset role;
update public.profiles set role = 'admin' where id = tests.id('budi');
select tests.login('admin');
set local role authenticated;
select lives_ok($$ select public.delete_my_account() $$, 'with a second admin, the first can leave');
reset role;
select ok(not exists (select 1 from public.profiles where id = tests.id('admin')), 'admin gone');

select * from finish();
rollback;
