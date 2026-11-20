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
select set_config('request.jwt.claims', '', true);
set local role anon;
select is(public.check_invite('nope'), 'invite_invalid', 'anon can check an invite');
select throws_ok($$ select public.create_invite() $$, '42501', null, 'anon cannot create invites');
select throws_ok($$ select public.admin_list_users() $$, '42501', null, 'anon cannot list users');
select throws_ok($$ select public.my_profile() $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select public.delete_my_account() $$, '42501', null, 'anon cannot delete accounts');
reset role;
-- (checked as postgres: anon has no USAGE on schema private, so the regprocedure cast itself fails under the anon role)
select ok(not has_function_privilege('anon', 'private.can_join_topic(text)', 'execute'), 'anon cannot run private helpers');

select tests.login('admin');
set local role authenticated;
select lives_ok($$ select public.my_profile() $$, 'authenticated can call RPCs');
select lives_ok($$ select public.check_invite('x') $$, 'authenticated can check invites');
reset role;

-- Bonus: the only function anon can execute in public/private is check_invite.
select is(
  (select coalesce(string_agg(n.nspname || '.' || p.proname, ', ' order by n.nspname, p.proname), '')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and has_function_privilege('anon', p.oid, 'execute')),
  'public.check_invite',
  'anon can execute exactly check_invite');
select ok(has_function_privilege('authenticated', 'private.can_join_topic(text)', 'execute'), 'authenticated keeps execute on private helpers');

-- Triggers check EXECUTE when created, not when fired, so supabase_auth_admin needs no grant on
-- handle_new_user (verified with a real GoTrue sign-up after this migration). Tests insert as postgres.
select ok(not has_function_privilege('anon', 'public.handle_new_user()', 'execute'), 'anon cannot call the sign-up trigger function');

select * from finish();
rollback;
