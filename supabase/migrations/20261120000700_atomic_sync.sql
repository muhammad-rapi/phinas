-- Library sync writes, each in one transaction. Before these, a playlist upload was three requests
-- (upsert, delete tracks, insert tracks) and a likes upload two; a failure between them left the
-- server with a playlist without tracks, or with no likes at all.

-- Stores the caller's playlist and replaces its tracks.
-- p = { id, name, visibility, updated_at, tracks: [{ video_id, title, artist, cover_url, duration_sec }] }
-- Tracks keep the array order. Refuses ('phinas:not_owner') a playlist id that belongs to someone else.
create function public.replace_playlist(p jsonb) returns void
language plpgsql security definer set search_path = private, public as $$
declare
  u uuid := require_active();
  v_id uuid;
  v_name text;
  v_vis text;
  v_tracks jsonb;
  v_owner uuid;
begin
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'phinas:invalid_args'; end if;
  begin
    v_id := (p->>'id')::uuid;
  exception when invalid_text_representation then
    raise exception 'phinas:invalid_args';
  end;
  v_name := p->>'name';
  v_vis := coalesce(p->>'visibility', 'friends');
  v_tracks := coalesce(p->'tracks', '[]'::jsonb);
  if v_id is null or v_name is null or jsonb_typeof(v_tracks) <> 'array' then
    raise exception 'phinas:invalid_args';
  end if;
  if v_vis not in ('private', 'friends', 'public') then raise exception 'phinas:invalid_args'; end if;

  -- The row lock keeps a concurrent call for the same id from slipping between the check and the write.
  select owner_id into v_owner from playlists where id = v_id for update;
  if found and v_owner <> u then raise exception 'phinas:not_owner'; end if;

  insert into playlists (id, owner_id, name, visibility, updated_at)
  values (v_id, u, v_name, v_vis, coalesce((p->>'updated_at')::timestamptz, now()))
  on conflict (id) do update
    set name = excluded.name, visibility = excluded.visibility, updated_at = excluded.updated_at
    where playlists.owner_id = u;
  -- Someone else inserted the same id meanwhile: the update above did nothing.
  if not exists (select 1 from playlists where id = v_id and owner_id = u) then
    raise exception 'phinas:not_owner';
  end if;

  delete from playlist_tracks where playlist_id = v_id;
  insert into playlist_tracks (playlist_id, position, video_id, title, artist, cover_url, duration_sec)
  select v_id, (t.ord - 1)::int, t.e->>'video_id', t.e->>'title', t.e->>'artist',
         coalesce(t.e->>'cover_url', ''), round((t.e->>'duration_sec')::numeric)::int
    from jsonb_array_elements(v_tracks) with ordinality as t(e, ord);
end $$;

-- Replaces all of the caller's likes with p = [{ video_id, title, artist, cover_url, duration_sec, liked_at }].
create function public.replace_likes(p jsonb) returns void
language plpgsql security definer set search_path = private, public as $$
declare u uuid := require_active();
begin
  if p is null or jsonb_typeof(p) <> 'array' then raise exception 'phinas:invalid_args'; end if;
  delete from liked_tracks where owner_id = u;
  insert into liked_tracks (owner_id, video_id, title, artist, cover_url, duration_sec, liked_at)
  select u, e->>'video_id', e->>'title', e->>'artist', coalesce(e->>'cover_url', ''),
         round((e->>'duration_sec')::numeric)::int, coalesce((e->>'liked_at')::timestamptz, now())
    from jsonb_array_elements(p) as e
  on conflict (owner_id, video_id) do nothing;
end $$;

revoke execute on function public.replace_playlist(jsonb), public.replace_likes(jsonb) from public, anon;
grant execute on function public.replace_playlist(jsonb), public.replace_likes(jsonb) to authenticated, service_role;
