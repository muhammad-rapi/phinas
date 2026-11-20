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

select tests.login('budi');
set local role authenticated;
select throws_ok($$ select public.send_friend_request('PHN-ZZZZ') $$, 'P0001', 'phinas:friend_code_invalid',
  'unknown friend code');
select throws_ok($$ select public.send_friend_request(tests.fcode('budi')) $$, 'P0001', 'phinas:self_friend',
  'cannot befriend yourself');
select lives_ok($$ select public.send_friend_request(lower(tests.fcode('sari'))) $$, 'request sent (case-insensitive)');
select is(jsonb_array_length(public.list_friend_requests()), 1, 'the sender sees the request');
select is((public.list_friend_requests()->0->>'incoming')::boolean, false, 'it is outgoing for the sender');
select ok(not private.are_friends(tests.id('budi'), tests.id('sari')), 'pending is not friends yet');
select lives_ok($$ select public.send_friend_request(tests.fcode('sari')) $$, 'sending twice is harmless');
reset role;

select tests.login('sari');
set local role authenticated;
select is((public.list_friend_requests()->0->>'incoming')::boolean, true, 'incoming for the receiver');
select is(public.list_friend_requests()->0->>'name', 'budi', 'request shows the sender name');
select throws_ok($$ select public.respond_friend_request(gen_random_uuid(), true) $$, 'P0001', 'phinas:request_not_found',
  'unknown request');
select lives_ok($$ select public.respond_friend_request(tests.fid('budi', 'sari'), true) $$, 'accept');
select ok(private.are_friends(tests.id('budi'), tests.id('sari')), 'now friends');
select throws_ok($$ select public.send_friend_request(tests.fcode('budi')) $$, 'P0001', 'phinas:already_friends',
  'already friends');
select is(jsonb_array_length(public.list_friends()), 2, 'sari has two friends');
select is((select f->>'canListen' from jsonb_array_elements(public.list_friends()) f where f->>'name' = 'budi'), 'true',
  'friends can listen together by default');

-- Partner: request, then the other side accepts.
select lives_ok($$ select public.request_partner(tests.fid('budi', 'sari')) $$, 'partner requested');
select is((select f->>'partnerRequest' from jsonb_array_elements(public.list_friends()) f where f->>'name' = 'budi'),
  'outgoing', 'outgoing partner request');
reset role;

select tests.login('budi');
set local role authenticated;
select is((select f->>'partnerRequest' from jsonb_array_elements(public.list_friends()) f where f->>'name' = 'sari'),
  'incoming', 'incoming partner request');
select lives_ok($$ select public.respond_partner(tests.fid('budi', 'sari'), true) $$, 'partner accepted');
select ok(private.is_partner(tests.id('budi'), tests.id('sari')), 'now partners');
select is(public.list_friends()->0->>'name', 'sari', 'the partner is listed first');
select is((public.list_friends()->0->>'isPartner')::boolean, true, 'isPartner flag');
reset role;

select tests.login('admin');
set local role authenticated;
select throws_ok($$ select public.request_partner(tests.fid('admin', 'budi')) $$, 'P0001', 'phinas:partner_taken',
  'cannot ask someone who already has a partner');
select throws_ok($$ select public.request_partner(tests.fid('budi', 'sari')) $$, 'P0001', 'phinas:request_not_found',
  'cannot touch a friendship you are not in');
reset role;

select tests.login('budi');
set local role authenticated;
select lives_ok($$ select public.end_partner(tests.fid('budi', 'sari')) $$, 'end partner');
select ok(not private.is_partner(tests.id('budi'), tests.id('sari')), 'no longer partners');
select ok(private.are_friends(tests.id('budi'), tests.id('sari')), 'still friends');

-- Decline a partner request.
select lives_ok($$ select public.request_partner(tests.fid('budi', 'sari')) $$, 'ask again');
reset role;
select tests.login('sari');
set local role authenticated;
select lives_ok($$ select public.respond_partner(tests.fid('budi', 'sari'), false) $$, 'decline');
select is((select f->>'partnerRequest' from jsonb_array_elements(public.list_friends()) f where f->>'name' = 'budi'),
  null, 'request cleared after decline');
reset role;

-- Remove a friend.
select tests.login('budi');
set local role authenticated;
select lives_ok($$ select public.remove_friend(tests.fid('budi', 'sari')) $$, 'remove friend');
select ok(not private.are_friends(tests.id('budi'), tests.id('sari')), 'not friends anymore');

-- Profile.
select is(public.my_profile()->>'friendCode', tests.fcode('budi'), 'my_profile shows the friend code');
select is(public.my_profile()->>'role', 'user', 'my_profile shows the role');
select lives_ok($$ select public.update_my_profile('Budi B', 'partner') $$, 'update profile');
select is(public.my_profile()->>'displayName', 'Budi B', 'name updated');
select is(public.my_profile()->>'listenScope', 'partner', 'scope updated');
select lives_ok($$ select public.update_my_profile(null, 'friends') $$, 'null keeps the name');
select is(public.my_profile()->>'displayName', 'Budi B', 'name kept');
select throws_ok($$ select public.update_my_profile('   ', null) $$, 'P0001', 'phinas:name_invalid', 'blank name');
select throws_ok($$ select public.update_my_profile(repeat('x', 31), null) $$, 'P0001', 'phinas:name_invalid', 'long name');
select throws_ok($$ select public.update_my_profile(null, 'everyone') $$, 'P0001', 'phinas:scope_invalid', 'bad scope');
select is((public.get_config()->>'listenTogetherEnabled')::boolean, true, 'get_config');
select is((public.get_config()->>'inviteQuota')::int, 3, 'get_config quota');
reset role;

-- Without JWT claims there is no signed-in user.
select set_config('request.jwt.claims', '', true);
select throws_ok($$ select public.my_profile() $$, 'P0001', 'phinas:not_signed_in', 'needs a signed-in user');

select * from finish();
rollback;
