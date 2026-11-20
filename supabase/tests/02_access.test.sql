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

-- admin is friends with budi and sari; budi and sari are strangers.
select tests.new_user('admin');
select tests.new_user('budi', tests.invite('admin', 'b'));
select tests.new_user('sari', tests.invite('admin', 's'));

insert into public.playlists (id, owner_id, name, visibility) values
  ('00000000-0000-0000-0000-0000000000a1', tests.id('budi'), 'priv', 'private'),
  ('00000000-0000-0000-0000-0000000000a2', tests.id('budi'), 'fr', 'friends'),
  ('00000000-0000-0000-0000-0000000000a3', tests.id('budi'), 'pub', 'public');
insert into public.playlist_tracks (playlist_id, position, video_id, title, artist, cover_url, duration_sec) values
  ('00000000-0000-0000-0000-0000000000a1', 0, 'v1', 't', 'a', '', 1),
  ('00000000-0000-0000-0000-0000000000a2', 0, 'v2', 't', 'a', '', 1);
insert into public.liked_tracks (owner_id, video_id, title, artist, cover_url, duration_sec)
  values (tests.id('budi'), 'v1', 't', 'a', '', 1);

-- A friend.
select tests.login('admin');
set local role authenticated;
select results_eq($$ select name from public.playlists order by name $$, array['fr', 'pub'],
  'a friend sees friends and public playlists, not private');
select results_eq($$ select video_id from public.playlist_tracks $$, array['v2'],
  'a friend sees tracks of visible playlists only');
select is((select count(*)::int from public.liked_tracks), 1, 'a friend sees likes');
select is((select count(*)::int from public.app_config), 3, 'active users read config');
reset role;

insert into public.playlist_tracks (playlist_id, position, video_id, title, artist, cover_url, duration_sec)
  values ('00000000-0000-0000-0000-0000000000a3', 0, 'v3', 't', 'a', '', 1);

-- A stranger.
select tests.login('sari');
set local role authenticated;
select results_eq($$ select name from public.playlists order by name $$, array['pub'],
  'a stranger sees public playlists only');
select results_eq($$ select video_id from public.playlist_tracks $$, array['v3'],
  'a stranger sees tracks of a public playlist');
select is((select count(*)::int from public.liked_tracks), 0, 'a stranger sees no likes');
select is((select display_name from public.profiles where id = tests.id('budi')), 'budi',
  'a stranger sees the name of a public playlist owner');
select throws_ok($$ select role from public.profiles $$, '42501', null, 'role column is not readable');
select throws_ok($$ select friend_code from public.profiles $$, '42501', null, 'friend codes are not readable');
select is((select count(*)::int from public.friendships), 1, 'only own friendships are visible');
select is((select count(*)::int from public.invite_codes), 0, 'others invite codes are hidden');
reset role;

-- The owner.
select tests.login('budi');
set local role authenticated;
select results_eq($$ select name from public.playlists order by name $$, array['fr', 'priv', 'pub'],
  'the owner sees all own playlists');
select throws_ok($$ update public.profiles set display_name = 'x' $$, '42501', null,
  'profiles cannot be updated directly');
select throws_ok($$ insert into public.friendships (user_a, user_b, requested_by)
                   values (tests.id('admin'), tests.id('budi'), tests.id('budi')) $$, '42501', null,
  'friendships cannot be written directly');
select throws_ok($$ update public.app_config set value = 'false' $$, '42501', null,
  'config cannot be written directly');
select lives_ok($$ insert into public.playlists (id, name) values ('00000000-0000-0000-0000-0000000000b1', 'new') $$,
  'the owner can create a playlist');
select is((select owner_id from public.playlists where id = '00000000-0000-0000-0000-0000000000b1'), tests.id('budi'),
  'owner_id defaults to the caller');
select throws_ok($$ insert into public.playlists (id, owner_id, name)
                   values ('00000000-0000-0000-0000-0000000000b2', tests.id('sari'), 'hack') $$, '42501', null,
  'cannot create a playlist for someone else');
select lives_ok($$ update public.playlists set visibility = 'public' where id = '00000000-0000-0000-0000-0000000000a1' $$,
  'the owner can change visibility');
reset role;

-- Writes cannot reach another user's rows.
insert into public.playlists (id, owner_id, name, visibility)
  values ('00000000-0000-0000-0000-0000000000c1', tests.id('sari'), 'sari fr', 'friends');
select tests.login('budi');
set local role authenticated;
select throws_ok($$ insert into public.playlists (id, name) values ('00000000-0000-0000-0000-0000000000c1', 'hijack')
                   on conflict (id) do update set name = excluded.name $$, '42501', null,
  'cannot hijack another user''s playlist by upsert');
select throws_ok($$ update public.playlists set owner_id = tests.id('sari')
                   where id = '00000000-0000-0000-0000-0000000000a2' $$, '42501', null,
  'cannot hand a playlist to someone else');
select throws_ok($$ insert into public.playlist_tracks (playlist_id, position, video_id, title, artist, cover_url, duration_sec)
                   values ('00000000-0000-0000-0000-0000000000c1', 0, 'x', 't', 'a', '', 1) $$, '42501', null,
  'cannot add tracks to another user''s playlist');
select throws_ok($$ insert into public.liked_tracks (owner_id, video_id, title, artist, cover_url, duration_sec)
                   values (tests.id('sari'), 'x', 't', 'a', '', 1) $$, '42501', null,
  'cannot like a track for someone else');
reset role;

-- A pending friendship grants nothing.
insert into public.friendships (user_a, user_b, status, requested_by)
  values (least(tests.id('budi'), tests.id('sari')), greatest(tests.id('budi'), tests.id('sari')), 'pending', tests.id('budi'));
select tests.login('sari');
set local role authenticated;
select is((select count(*)::int from public.playlists where name = 'fr'), 0,
  'a pending friend does not see friends playlists');
reset role;
delete from public.friendships where id = tests.fid('budi', 'sari');

-- A disabled owner's content is hidden from everyone.
update public.profiles set disabled = true where id = tests.id('budi');
select tests.login('sari');
set local role authenticated;
select is((select count(*)::int from public.playlists where visibility = 'public'), 0,
  'public playlists of a disabled owner are hidden');
reset role;
select tests.login('admin');
set local role authenticated;
select is((select count(*)::int from public.playlists where owner_id = tests.id('budi')), 0,
  'a friend does not see playlists of a disabled owner');
select is((select count(*)::int from public.liked_tracks where owner_id = tests.id('budi')), 0,
  'a friend does not see likes of a disabled owner');
reset role;
update public.profiles set disabled = false where id = tests.id('budi');

-- A disabled account reads nothing.
update public.profiles set disabled = true where id = tests.id('admin');
select tests.login('admin');
set local role authenticated;
select is((select count(*)::int from public.playlists), 0, 'disabled: no playlists');
select is((select count(*)::int from public.liked_tracks), 0, 'disabled: no likes');
select is((select count(*)::int from public.app_config), 0, 'disabled: no config');
select is((select count(*)::int from public.profiles), 0, 'disabled: no profiles, not even own');
select is((select count(*)::int from public.friendships), 0, 'disabled: no friendships');
select is((select count(*)::int from public.invite_codes), 0, 'disabled: no invite codes');
reset role;

-- Signed-out callers read nothing.
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$ select id from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select id from public.playlists $$, '42501', null, 'anon cannot read playlists');
select throws_ok($$ select key from public.app_config $$, '42501', null, 'anon cannot read config');
select throws_ok($$ select id from public.friendships $$, '42501', null, 'anon cannot read friendships');
reset role;

select * from finish();
rollback;
