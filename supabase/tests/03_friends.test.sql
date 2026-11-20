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
select throws_ok($$ select public.send_friend_request('PHN-ZZZZZZ') $$, 'P0001', 'phinas:friend_code_invalid',
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

-- Names with control characters are refused; surrounding whitespace is trimmed.
select tests.login('budi');
set local role authenticated;
select throws_ok($$ select public.update_my_profile(E'Bu\tdi', null) $$, 'P0001', 'phinas:name_invalid',
  'control characters in a name');
select lives_ok($$ select public.update_my_profile(E'\t Budi B \n', null) $$, 'padded name');
select is(public.my_profile()->>'displayName', 'Budi B', 'tabs and newlines trimmed');
reset role;

-- Entering the code of someone who already asked you accepts.
select tests.new_user('dina', tests.invite('admin', 'd'));
select tests.new_user('eko', tests.invite('admin', 'e'));
select tests.new_user('fani', tests.invite('admin', 'f'));
select tests.login('dina');
set local role authenticated;
select lives_ok($$ select public.send_friend_request(tests.fcode('eko')) $$, 'dina asks eko');
select lives_ok($$ select public.send_friend_request(tests.fcode('fani')) $$, 'dina asks fani');
select throws_ok($$ select public.respond_friend_request(tests.fid('dina', 'fani'), true) $$, 'P0001',
  'phinas:request_not_found', 'cannot accept your own friend request');
reset role;
select tests.login('eko');
set local role authenticated;
select is(public.send_friend_request(tests.fcode('dina')), tests.fid('dina', 'eko'),
  'entering their code returns the existing request');
select ok(private.are_friends(tests.id('dina'), tests.id('eko')), 'entering the code of someone who asked accepts');
select throws_ok($$ select public.respond_friend_request(tests.fid('dina', 'eko'), null) $$, 'P0001',
  'phinas:invalid_args', 'respond_friend_request needs a decision');
reset role;

-- Partner: asking back accepts; you cannot accept your own request.
select tests.login('dina');
set local role authenticated;
select lives_ok($$ select public.request_partner(tests.fid('dina', 'eko')) $$, 'dina asks eko to be partner');
select throws_ok($$ select public.respond_partner(tests.fid('dina', 'eko'), true) $$, 'P0001',
  'phinas:request_not_found', 'cannot accept your own partner request');
reset role;
select tests.login('eko');
set local role authenticated;
select throws_ok($$ select public.respond_partner(tests.fid('dina', 'eko'), null) $$, 'P0001',
  'phinas:invalid_args', 'respond_partner needs a decision');
select lives_ok($$ select public.request_partner(tests.fid('dina', 'eko')) $$, 'eko asks back');
select ok(private.is_partner(tests.id('dina'), tests.id('eko')), 'asking back accepts the partner request');
reset role;
select tests.login('dina');
set local role authenticated;
select throws_ok($$ select public.request_partner(tests.fid('admin', 'dina')) $$, 'P0001', 'phinas:partner_taken',
  'someone with a partner cannot ask another friend');
reset role;

-- Outsiders cannot touch a friendship.
select tests.befriend('budi', 'sari');
select tests.login('budi');
set local role authenticated;
select lives_ok($$ select public.request_partner(tests.fid('budi', 'sari')) $$, 'budi asks sari again');
reset role;
select tests.login('admin');
set local role authenticated;
select throws_ok($$ select public.remove_friend(tests.fid('budi', 'sari')) $$, 'P0001', 'phinas:request_not_found',
  'outsider cannot remove a friendship');
select throws_ok($$ select public.end_partner(tests.fid('budi', 'sari')) $$, 'P0001', 'phinas:request_not_found',
  'outsider cannot end a partnership');
select throws_ok($$ select public.respond_partner(tests.fid('budi', 'sari'), true) $$, 'P0001',
  'phinas:request_not_found', 'outsider cannot answer a partner request');
reset role;
select ok(not private.is_partner(tests.id('budi'), tests.id('sari')), 'still not partners');

-- Accepting a partner clears other open partner requests of both people.
select tests.new_user('gita', tests.invite('admin', 'g'));
select tests.new_user('hadi', tests.invite('admin', 'h'));
select tests.new_user('ina', tests.invite('admin', 'i'));
select tests.befriend('gita', 'ina');
select tests.befriend('hadi', 'ina');
select tests.login('gita');
set local role authenticated;
select lives_ok($$ select public.request_partner(tests.fid('gita', 'ina')) $$, 'gita asks ina');
reset role;
select tests.login('hadi');
set local role authenticated;
select lives_ok($$ select public.request_partner(tests.fid('hadi', 'ina')) $$, 'hadi asks ina');
reset role;
select tests.login('ina');
set local role authenticated;
select lives_ok($$ select public.respond_partner(tests.fid('gita', 'ina'), true) $$, 'ina accepts gita');
select is((select f->>'partnerRequest' from jsonb_array_elements(public.list_friends()) f where f->>'name' = 'hadi'),
  null, 'the other partner request is cleared');
reset role;

-- Disabled accounts.
select tests.befriend('eko', 'fani');
update public.friendships set requested_by = tests.id('fani'), status = 'pending' where id = tests.fid('eko', 'fani');
update public.profiles set disabled = true where id = tests.id('fani');
select tests.login('fani');
set local role authenticated;
select is((public.my_profile()->>'disabled')::boolean, true, 'a disabled user can read their profile');
select throws_ok($$ select public.list_friends() $$, 'P0001', 'phinas:account_disabled', 'disabled: list_friends');
select throws_ok($$ select public.send_friend_request(tests.fcode('budi')) $$, 'P0001', 'phinas:account_disabled',
  'disabled: send_friend_request');
select throws_ok($$ select public.create_invite() $$, 'P0001', 'phinas:account_disabled', 'disabled: create_invite');
reset role;
select tests.login('eko');
set local role authenticated;
select throws_ok($$ select public.send_friend_request(tests.fcode('fani')) $$, 'P0001', 'phinas:friend_code_invalid',
  'a disabled user''s code does not work');
select throws_ok($$ select public.respond_friend_request(tests.fid('eko', 'fani'), true) $$, 'P0001',
  'phinas:request_not_found', 'cannot accept a request from a disabled user');
reset role;
select tests.login('admin');
set local role authenticated;
select throws_ok($$ select public.request_partner(tests.fid('admin', 'fani')) $$, 'P0001', 'phinas:request_not_found',
  'cannot ask a disabled friend to be partner');
reset role;
update public.friendships set partner_requested_by = tests.id('fani') where id = tests.fid('admin', 'fani');
select tests.login('admin');
set local role authenticated;
select throws_ok($$ select public.respond_partner(tests.fid('admin', 'fani'), true) $$, 'P0001',
  'phinas:request_not_found', 'cannot accept a partner request from a disabled user');
reset role;
update public.friendships set partner_requested_by = null where id = tests.fid('admin', 'fani');
update public.profiles set disabled = false where id = tests.id('fani');

-- At most 20 outgoing pending requests.
select tests.new_user('kiki', tests.invite('admin', 'k'));
select tests.new_user('lena', tests.invite('admin', 'l'));
select tests.new_user('mona', tests.invite('admin', 'm'));
do $$
declare v uuid;
begin
  for i in 1..20 loop
    v := tests.new_user('t' || i, tests.invite('admin', 't' || i));
    insert into public.friendships (user_a, user_b, requested_by)
    values (least(v, tests.id('kiki')), greatest(v, tests.id('kiki')), tests.id('kiki'));
  end loop;
end $$;
select tests.login('lena');
set local role authenticated;
select lives_ok($$ select public.send_friend_request(tests.fcode('kiki')) $$, 'lena asks kiki');
reset role;
select tests.login('kiki');
set local role authenticated;
select throws_ok($$ select public.send_friend_request(tests.fcode('mona')) $$, 'P0001', 'phinas:too_many_requests',
  'too many pending requests');
select lives_ok($$ select public.send_friend_request(tests.fcode('t1')) $$, 'resending an existing request still works');
select lives_ok($$ select public.send_friend_request(tests.fcode('lena')) $$, 'accepting an incoming one still works');
select ok(private.are_friends(tests.id('kiki'), tests.id('lena')), 'kiki and lena are friends');
reset role;

-- canListen needs both scopes and the global switch.
select tests.login('dina');
set local role authenticated;
select lives_ok($$ select public.update_my_profile(null, 'off') $$, 'dina turns listening off');
reset role;
select tests.login('eko');
set local role authenticated;
select is((select f->>'canListen' from jsonb_array_elements(public.list_friends()) f where f->>'name' = 'dina'), 'false',
  'one side off: cannot listen');
reset role;
select tests.login('dina');
set local role authenticated;
select lives_ok($$ select public.update_my_profile(null, 'friends') $$, 'dina turns listening back on');
reset role;
select tests.login('eko');
set local role authenticated;
select is((select f->>'canListen' from jsonb_array_elements(public.list_friends()) f where f->>'name' = 'dina'), 'true',
  'both sides on: can listen');
reset role;
update public.app_config set value = 'false' where key = 'listen_together_enabled';
select tests.login('eko');
set local role authenticated;
select is((select f->>'canListen' from jsonb_array_elements(public.list_friends()) f where f->>'name' = 'dina'), 'false',
  'global switch off: cannot listen');
reset role;
update public.app_config set value = 'true' where key = 'listen_together_enabled';

-- Without JWT claims there is no signed-in user.
select set_config('request.jwt.claims', '', true);
select throws_ok($$ select public.my_profile() $$, 'P0001', 'phinas:not_signed_in', 'needs a signed-in user');

select * from finish();
rollback;
