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
select tests.new_user('sari', tests.invite('admin', 's'));
select tests.new_user('eka', tests.invite('admin', 'e'));
-- budi and sari became friends of admin through their invites; make budi and sari friends too.
select tests.befriend('budi', 'sari');

select tests.login('budi');
set local role authenticated;
select lives_ok($$ select public.set_my_avatar('data:image/jpeg;base64,AAAA') $$, 'a small jpeg is accepted');
select is(public.my_profile()->>'avatar', 'data:image/jpeg;base64,AAAA', 'my_profile returns it');
select throws_ok($$ select public.set_my_avatar('data:image/png;base64,AAAA') $$, 'P0001', 'phinas:avatar_invalid',
  'only jpeg data urls');
select throws_ok($$ select public.set_my_avatar('data:image/jpeg;base64,' || repeat('A', 60000)) $$, 'P0001',
  'phinas:avatar_invalid', 'too large');
select throws_ok($$ update public.profiles set avatar = null where id = tests.id('budi') $$, '42501', null,
  'no direct writes to the column');
reset role;

select tests.login('sari');
set local role authenticated;
select is(
  (select f->>'avatar' from jsonb_array_elements(public.list_friends()) f where f->>'name' = 'budi'),
  'data:image/jpeg;base64,AAAA', 'a friend sees it in list_friends');
select is((select avatar from public.profiles where id = tests.id('budi')), 'data:image/jpeg;base64,AAAA',
  'a friend can read the column');
reset role;

select tests.login('eka');
set local role authenticated;
select is((select count(*) from public.profiles where id = tests.id('budi'))::int, 0, 'a stranger cannot read the profile');
reset role;

select tests.login('budi');
set local role authenticated;
select lives_ok($$ select public.set_my_avatar(null) $$, 'null removes it');
select is(public.my_profile()->'avatar', 'null'::jsonb, 'removed');
reset role;

set local role anon;
select throws_ok($$ select public.set_my_avatar(null) $$, '42501', null, 'anon cannot call it');
reset role;

select * from finish();
rollback;
