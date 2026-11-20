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

-- budi and sari are strangers; a playlist id of budi's is what sari tries to take over.
select tests.new_user('admin');
select tests.new_user('budi', tests.invite('admin', 'b'));
select tests.new_user('sari', tests.invite('admin', 's'));
insert into public.liked_tracks (owner_id, video_id, title, artist, cover_url, duration_sec)
  values (tests.id('sari'), 'sv', 't', 'a', '', 1);

-- The owner.
select tests.login('budi');
set local role authenticated;
select lives_ok($$ select public.replace_playlist(jsonb_build_object(
    'id', '00000000-0000-0000-0000-0000000000b1', 'name', 'Satu', 'visibility', 'private',
    'updated_at', '2026-11-20T10:00:00Z',
    'tracks', jsonb_build_array(
      jsonb_build_object('video_id', 'v1', 'title', 't1', 'artist', 'a', 'cover_url', 'c1', 'duration_sec', 10),
      jsonb_build_object('video_id', 'v2', 'title', 't2', 'artist', 'a', 'cover_url', 'c2', 'duration_sec', 20)))) $$,
  'the owner creates a playlist with tracks');
select results_eq(
  $$ select name, visibility, owner_id from public.playlists where id = '00000000-0000-0000-0000-0000000000b1' $$,
  $$ values ('Satu', 'private', tests.id('budi')) $$,
  'the playlist row is stored for the caller');
select lives_ok($$ select public.replace_playlist(jsonb_build_object(
    'id', '00000000-0000-0000-0000-0000000000b1', 'name', 'Dua', 'visibility', 'friends',
    'updated_at', '2026-11-20T11:00:00Z',
    'tracks', jsonb_build_array(
      jsonb_build_object('video_id', 'v3', 'title', 't3', 'artist', 'a', 'cover_url', '', 'duration_sec', 30),
      jsonb_build_object('video_id', 'v1', 'title', 't1', 'artist', 'a', 'cover_url', 'c1', 'duration_sec', 10),
      jsonb_build_object('video_id', 'v4', 'title', 't4', 'artist', 'a', 'cover_url', '', 'duration_sec', 40)))) $$,
  'the owner replaces the playlist');
select results_eq(
  $$ select position, video_id from public.playlist_tracks
     where playlist_id = '00000000-0000-0000-0000-0000000000b1' order by position $$,
  $$ values (0, 'v3'), (1, 'v1'), (2, 'v4') $$,
  'the tracks are replaced, in order');
select results_eq(
  $$ select name, visibility, updated_at from public.playlists where id = '00000000-0000-0000-0000-0000000000b1' $$,
  $$ values ('Dua', 'friends', '2026-11-20T11:00:00Z'::timestamptz) $$,
  'name, visibility and updated_at are updated');
select throws_ok($$ select public.replace_playlist(jsonb_build_object(
    'id', '00000000-0000-0000-0000-0000000000b1', 'name', 'X', 'visibility', 'everyone', 'tracks', '[]'::jsonb)) $$,
  'P0001', 'phinas:invalid_args', 'an unknown visibility is refused');
select throws_ok($$ select public.replace_playlist(jsonb_build_object(
    'id', '00000000-0000-0000-0000-0000000000b1', 'name', 'X', 'visibility', 'private',
    'tracks', jsonb_build_array(jsonb_build_object('video_id', 'v9')))) $$,
  '23502', null, 'a bad track fails the whole call');
select results_eq(
  $$ select count(*)::int from public.playlist_tracks where playlist_id = '00000000-0000-0000-0000-0000000000b1' $$,
  array[3], 'a failed call leaves the old tracks');
select lives_ok($$ select public.replace_likes(jsonb_build_array(
    jsonb_build_object('video_id', 'l1', 'title', 't', 'artist', 'a', 'cover_url', '', 'duration_sec', 1, 'liked_at', '2026-11-20T10:00:00Z'),
    jsonb_build_object('video_id', 'l2', 'title', 't', 'artist', 'a', 'cover_url', '', 'duration_sec', 2, 'liked_at', '2026-11-20T11:00:00Z'))) $$,
  'the owner replaces their likes');
select lives_ok($$ select public.replace_likes(jsonb_build_array(
    jsonb_build_object('video_id', 'l2', 'title', 't', 'artist', 'a', 'cover_url', '', 'duration_sec', 2, 'liked_at', '2026-11-20T11:00:00Z'),
    jsonb_build_object('video_id', 'l3', 'title', 't', 'artist', 'a', 'cover_url', '', 'duration_sec', 3, 'liked_at', '2026-11-20T12:00:00Z'))) $$,
  'and replaces them again');
select results_eq($$ select video_id from public.liked_tracks where owner_id = tests.id('budi') order by video_id $$,
  array['l2', 'l3'], 'likes are replaced as a whole');
reset role;
select results_eq($$ select video_id from public.liked_tracks where owner_id = tests.id('sari') $$,
  array['sv'], 'replace_likes leaves other users likes alone');

-- Someone else.
select tests.login('sari');
set local role authenticated;
select throws_ok($$ select public.replace_playlist(jsonb_build_object(
    'id', '00000000-0000-0000-0000-0000000000b1', 'name', 'Diambil', 'visibility', 'public', 'tracks', '[]'::jsonb)) $$,
  'P0001', 'phinas:not_owner', 'another user cannot replace someone else''s playlist');
reset role;
select results_eq(
  $$ select name, owner_id from public.playlists where id = '00000000-0000-0000-0000-0000000000b1' $$,
  $$ values ('Dua', tests.id('budi')) $$,
  'the playlist is untouched');
select results_eq(
  $$ select count(*)::int from public.playlist_tracks where playlist_id = '00000000-0000-0000-0000-0000000000b1' $$,
  array[3], 'its tracks are untouched');

-- A disabled account.
update public.profiles set disabled = true where id = tests.id('budi');
select tests.login('budi');
set local role authenticated;
select throws_ok($$ select public.replace_playlist(jsonb_build_object(
    'id', '00000000-0000-0000-0000-0000000000b2', 'name', 'X', 'visibility', 'private', 'tracks', '[]'::jsonb)) $$,
  'P0001', 'phinas:account_disabled', 'a disabled user cannot replace playlists');
select throws_ok($$ select public.replace_likes('[]'::jsonb) $$,
  'P0001', 'phinas:account_disabled', 'a disabled user cannot replace likes');
reset role;
select results_eq($$ select count(*)::int from public.liked_tracks where owner_id = tests.id('budi') $$,
  array[2], 'a disabled user keeps their likes');
update public.profiles set disabled = false where id = tests.id('budi');

-- Signed out.
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$ select public.replace_playlist('{}'::jsonb) $$, '42501', null, 'anon cannot replace playlists');
select throws_ok($$ select public.replace_likes('[]'::jsonb) $$, '42501', null, 'anon cannot replace likes');
reset role;
select ok(has_function_privilege('authenticated', 'public.replace_playlist(jsonb)', 'execute'),
  'authenticated may replace playlists');
select ok(has_function_privilege('authenticated', 'public.replace_likes(jsonb)', 'execute'),
  'authenticated may replace likes');

select * from finish();
rollback;
