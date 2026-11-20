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
  values (public.gen_code('', 8), tests.id(p_by)) returning code into c;
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

select is((select count(*)::int from public.profiles), 0, 'starts from an empty database');

select tests.new_user('admin');
select is((select role from public.profiles where id = tests.id('admin')), 'admin',
  'first user becomes admin without an invite');
select matches((select friend_code from public.profiles where id = tests.id('admin')), '^PHN-[A-Z2-9]{4}$',
  'friend code format');
select isnt((select accepted_terms_at from public.profiles where id = tests.id('admin')), null,
  'terms acceptance recorded');

select throws_ok($$ select tests.new_user('nocode') $$, 'P0001', 'phinas:invite_invalid',
  'later users need an invite');
select throws_ok($$ select tests.new_user('typo', 'NOPE2345') $$, 'P0001', 'phinas:invite_invalid',
  'unknown code is rejected');

select tests.invite('admin', 'c1');
select lives_ok($$ select tests.new_user('budi', tests.code('c1')) $$, 'a valid code registers');
select is((select role from public.profiles where id = tests.id('budi')), 'user', 'invitee is a normal user');
select is((select display_name from public.profiles where id = tests.id('budi')), 'budi', 'display name from metadata');
select is((select invited_by from public.profiles where id = tests.id('budi')), tests.id('admin'), 'invited_by recorded');
select ok(public.are_friends(tests.id('budi'), tests.id('admin')), 'invitee and inviter are friends');
select isnt((select used_at from public.invite_codes where code = tests.code('c1')), null, 'code marked used');
select throws_ok($$ select tests.new_user('cici', tests.code('c1')) $$, 'P0001', 'phinas:invite_used',
  'a code works once');

select tests.invite('admin', 'c2');
update public.invite_codes set expires_at = now() - interval '1 minute' where code = tests.code('c2');
select throws_ok($$ select tests.new_user('dedi', tests.code('c2')) $$, 'P0001', 'phinas:invite_expired',
  'expired code');

select tests.invite('admin', 'c3');
update public.invite_codes set revoked = true where code = tests.code('c3');
select throws_ok($$ select tests.new_user('eko', tests.code('c3')) $$, 'P0001', 'phinas:invite_revoked',
  'revoked code');

select tests.invite('admin', 'c4');
select throws_ok($$ select tests.new_user('fani', tests.code('c4'), false) $$, 'P0001', 'phinas:terms_required',
  'terms must be accepted');

update public.app_config set value = 'false' where key = 'registration_open';
select throws_ok($$ select tests.new_user('gita', tests.code('c4')) $$, 'P0001', 'phinas:registration_closed',
  'registration can be closed');
select is(public.check_invite(tests.code('c4')), 'registration_closed', 'check_invite reports closed');
update public.app_config set value = 'true' where key = 'registration_open';

select is(public.check_invite(lower(tests.code('c4'))), 'ok', 'check_invite ignores case');
select is(public.check_invite('  ' || tests.code('c4') || ' '), 'ok', 'check_invite trims spaces');
select is(public.check_invite('nope'), 'invite_invalid', 'check_invite: unknown');
select is(public.check_invite(tests.code('c1')), 'invite_used', 'check_invite: used');

select is((select value from public.app_config where key = 'invite_quota'), '3'::jsonb, 'default quota');
select is((select value from public.app_config where key = 'listen_together_enabled'), 'true'::jsonb,
  'listen together on by default');
select has_column('public', 'playlists', 'visibility', 'playlists have visibility');

-- Trigger normalises the code; a failed sign-up leaves the code unused.
select tests.invite('admin', 'c6');
select lives_ok($$ select tests.new_user('ika', ' ' || lower(tests.code('c6')) || ' ') $$,
  'the trigger accepts a lower-case, padded code');
select tests.invite('admin', 'c7');
select throws_ok($$ select tests.new_user('joko', tests.code('c7'), false) $$, 'P0001', 'phinas:terms_required',
  'terms missing');
select is((select used_at from public.invite_codes where code = tests.code('c7')), null,
  'a failed sign-up leaves the code unused');

-- One partner per user.
select tests.invite('admin', 'c5');
select tests.new_user('hana', tests.code('c5'));
update public.friendships set is_partner = true where id = tests.fid('admin', 'budi');
select throws_ok($$ update public.friendships set is_partner = true where id = tests.fid('admin', 'hana') $$,
  'P0001', 'phinas:partner_taken', 'a user cannot have two partners');
select throws_ok($$ insert into public.friendships (user_a, user_b, status, requested_by, is_partner)
  select least(tests.id('budi'), tests.id('ika')), greatest(tests.id('budi'), tests.id('ika')), 'accepted', tests.id('budi'), true $$,
  'P0001', 'phinas:partner_taken', 'the one-partner rule also applies on insert');

select tests.invite('hana', 'c8');
update public.profiles set disabled = true where id = tests.id('hana');
select is(public.check_invite(tests.code('c8')), 'invite_revoked', 'codes of a disabled inviter do not work');
update public.profiles set disabled = false where id = tests.id('hana');

select ok((select bool_and(relrowsecurity) from pg_class
  where oid in ('public.friendships'::regclass, 'public.invite_codes'::regclass, 'public.app_config'::regclass)),
  'new tables have RLS enabled');

select * from finish();
rollback;
