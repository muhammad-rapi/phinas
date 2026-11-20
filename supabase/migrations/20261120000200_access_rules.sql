-- Replace the two-account "everyone reads everything" policies.
-- Every rule requires the caller to be active, own rows included. Caller-only checks are wrapped
-- in (select ...) so Postgres evaluates them once per query instead of once per row.

drop policy "read profiles" on public.profiles;
drop policy "read playlists" on public.playlists;
drop policy "read playlist tracks" on public.playlist_tracks;
drop policy "read likes" on public.liked_tracks;
drop policy "write own playlists" on public.playlists;
drop policy "write own playlist tracks" on public.playlist_tracks;
drop policy "write own likes" on public.liked_tracks;

create index if not exists playlists_owner_id on public.playlists(owner_id);

-- Profiles: other people only ever see id and display_name. Writes go through RPCs.
revoke all on public.profiles from anon, authenticated;
grant select (id, display_name) on public.profiles to authenticated;

-- Content tables: signed-in users only, and no table-level admin privileges.
revoke all on public.playlists, public.playlist_tracks, public.liked_tracks from anon;
revoke truncate, references, trigger on public.playlists, public.playlist_tracks, public.liked_tracks
  from authenticated;

create policy "read visible profiles" on public.profiles for select to authenticated using (
  (select private.is_active((select auth.uid())))
  and (
    id = (select auth.uid())
    or id in (select private.friend_ids())
    or exists (select 1 from public.playlists p where p.owner_id = profiles.id and p.visibility = 'public')
  )
);

-- Disabled owners are hidden everywhere: friend_ids() skips them, the public branch checks them.
create policy "read visible playlists" on public.playlists for select to authenticated using (
  (select private.is_active((select auth.uid())))
  and (
    owner_id = (select auth.uid())
    or (visibility = 'friends' and owner_id in (select private.friend_ids()))
    or (visibility = 'public' and private.is_active(owner_id))
  )
);
create policy "write own playlists" on public.playlists for all to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_active((select auth.uid()))))
  with check (owner_id = (select auth.uid()) and (select private.is_active((select auth.uid()))));

-- Tracks follow their playlist (the subquery is itself filtered by the playlists policy).
create policy "read visible playlist tracks" on public.playlist_tracks for select to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id));
create policy "write own playlist tracks" on public.playlist_tracks for all to authenticated
  using (
    (select private.is_active((select auth.uid())))
    and exists (select 1 from public.playlists p where p.id = playlist_id and p.owner_id = (select auth.uid()))
  )
  with check (
    (select private.is_active((select auth.uid())))
    and exists (select 1 from public.playlists p where p.id = playlist_id and p.owner_id = (select auth.uid()))
  );

create policy "read visible likes" on public.liked_tracks for select to authenticated using (
  (select private.is_active((select auth.uid())))
  and (owner_id = (select auth.uid()) or owner_id in (select private.friend_ids()))
);
create policy "write own likes" on public.liked_tracks for all to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_active((select auth.uid()))))
  with check (owner_id = (select auth.uid()) and (select private.is_active((select auth.uid()))));

-- Friendships, invites and config: read here, write only through RPCs.
alter table public.friendships enable row level security;
alter table public.invite_codes enable row level security;
alter table public.app_config enable row level security;

revoke insert, update, delete, truncate on public.friendships, public.invite_codes, public.app_config
  from anon, authenticated;

create policy "read own friendships" on public.friendships for select to authenticated
  using ((select auth.uid()) in (user_a, user_b) and (select private.is_active((select auth.uid()))));
create policy "read own invites" on public.invite_codes for select to authenticated
  using (created_by = (select auth.uid()) and (select private.is_active((select auth.uid()))));
create policy "read config" on public.app_config for select to authenticated
  using ((select private.is_active((select auth.uid()))));
