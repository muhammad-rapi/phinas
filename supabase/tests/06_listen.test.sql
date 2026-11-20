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

-- admin is friends with budi and sari; budi and sari are partners; tono is only sari's friend.
select tests.new_user('admin');
select tests.new_user('budi', tests.invite('admin', 'b'));
select tests.new_user('sari', tests.invite('admin', 's'));
select tests.befriend('budi', 'sari');
update public.friendships set is_partner = true where id = tests.fid('budi', 'sari');
select tests.new_user('tono', tests.invite('sari', 't'));

select tests.login('budi');
set local role authenticated;
select ok(private.can_join_topic(tests.pair('budi', 'sari')), 'partners can join their pair');
select ok(private.can_join_topic(tests.pair('budi', 'admin')), 'friends can join with scope friends');
select ok(not private.can_join_topic(tests.pair('sari', 'admin')), 'cannot join a pair you are not in');
select ok(not private.can_join_topic('pair:' || greatest(tests.id('budi'), tests.id('sari')) || ':'
  || least(tests.id('budi'), tests.id('sari'))), 'unsorted pair topic is rejected');
select ok(not private.can_join_topic('pair:garbage:x'), 'malformed topic is rejected');
select ok(not private.can_join_topic('something-else'), 'unknown topic is rejected');
select ok(private.can_join_topic('presence:' || tests.id('budi')), 'own presence channel');
select ok(private.can_join_topic('presence:' || tests.id('sari')), 'a friend''s presence channel');
reset role;

select tests.login('tono');
set local role authenticated;
select ok(not private.can_join_topic('presence:' || tests.id('budi')), 'strangers cannot watch presence');
select ok(not private.can_join_topic(tests.pair('tono', 'budi')), 'strangers cannot pair');
reset role;

-- Scope 'partner' blocks other friends but not the partner.
update public.profiles set listen_scope = 'partner' where id = tests.id('budi');
select tests.login('admin');
set local role authenticated;
select ok(not private.can_join_topic(tests.pair('admin', 'budi')), 'partner-only scope blocks a friend');
reset role;
select tests.login('sari');
set local role authenticated;
select ok(private.can_join_topic(tests.pair('budi', 'sari')), 'partner-only scope allows the partner');
reset role;

-- Scope 'off' on either side blocks.
update public.profiles set listen_scope = 'off' where id = tests.id('sari');
select tests.login('budi');
set local role authenticated;
select ok(not private.can_join_topic(tests.pair('budi', 'sari')), 'the other side being off blocks');
reset role;
update public.profiles set listen_scope = 'friends' where id in (tests.id('budi'), tests.id('sari'));

-- Global switch.
update public.app_config set value = 'false' where key = 'listen_together_enabled';
select tests.login('budi');
set local role authenticated;
select ok(not private.can_join_topic(tests.pair('budi', 'sari')), 'global switch off blocks every pair');
select ok(private.can_join_topic('presence:' || tests.id('sari')), 'presence still works');
select is((select f->>'canListen' from jsonb_array_elements(public.list_friends()) f where f->>'name' = 'sari'),
  'false', 'list_friends reflects the switch');
reset role;
update public.app_config set value = 'true' where key = 'listen_together_enabled';

-- A disabled side blocks.
update public.profiles set disabled = true where id = tests.id('sari');
select tests.login('budi');
set local role authenticated;
select ok(not private.can_join_topic(tests.pair('budi', 'sari')), 'a disabled side blocks');
select ok(not private.can_join_topic('presence:' || tests.id('sari')), 'no presence of a disabled user');
reset role;

select ok(
  to_regclass('realtime.messages') is null
  or exists (select 1 from pg_policies where schemaname = 'realtime' and tablename = 'messages'
             and policyname = 'phinas join'),
  'realtime policies are installed when Realtime exists');

select * from finish();
rollback;
