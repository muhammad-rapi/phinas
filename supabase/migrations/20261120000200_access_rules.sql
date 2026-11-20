-- Replace the two-account "everyone reads everything" policies.

drop policy "read profiles" on public.profiles;
drop policy "read playlists" on public.playlists;
drop policy "read playlist tracks" on public.playlist_tracks;
drop policy "read likes" on public.liked_tracks;
drop policy "write own playlists" on public.playlists;
drop policy "write own playlist tracks" on public.playlist_tracks;
drop policy "write own likes" on public.liked_tracks;

-- Profiles: other people only ever see id and display_name. Writes go through RPCs.
revoke all on public.profiles from anon, authenticated;
grant select (id, display_name) on public.profiles to authenticated;

create policy "read visible profiles" on public.profiles for select to authenticated using (
  id = auth.uid()
  or (
    public.is_active(auth.uid())
    and (
      public.are_friends(auth.uid(), id)
      or exists (select 1 from public.playlists p where p.owner_id = profiles.id and p.visibility = 'public')
    )
  )
);

create policy "read visible playlists" on public.playlists for select to authenticated using (
  public.is_active(auth.uid())
  and (
    owner_id = auth.uid()
    or (visibility = 'friends' and public.are_friends(auth.uid(), owner_id))
    or (visibility = 'public' and public.is_active(owner_id))
  )
);
create policy "write own playlists" on public.playlists for all to authenticated
  using (owner_id = auth.uid() and public.is_active(auth.uid()))
  with check (owner_id = auth.uid() and public.is_active(auth.uid()));

-- Tracks follow their playlist (the subquery is itself filtered by the playlists policy).
create policy "read visible playlist tracks" on public.playlist_tracks for select to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id));
create policy "write own playlist tracks" on public.playlist_tracks for all to authenticated
  using (
    public.is_active(auth.uid())
    and exists (select 1 from public.playlists p where p.id = playlist_id and p.owner_id = auth.uid())
  )
  with check (
    public.is_active(auth.uid())
    and exists (select 1 from public.playlists p where p.id = playlist_id and p.owner_id = auth.uid())
  );

create policy "read visible likes" on public.liked_tracks for select to authenticated using (
  public.is_active(auth.uid())
  and (owner_id = auth.uid() or public.are_friends(auth.uid(), owner_id))
);
create policy "write own likes" on public.liked_tracks for all to authenticated
  using (owner_id = auth.uid() and public.is_active(auth.uid()))
  with check (owner_id = auth.uid() and public.is_active(auth.uid()));

-- Friendships, invites and config: read here, write only through RPCs.
alter table public.friendships enable row level security;
alter table public.invite_codes enable row level security;
alter table public.app_config enable row level security;

revoke insert, update, delete, truncate on public.friendships, public.invite_codes, public.app_config
  from anon, authenticated;

create policy "read own friendships" on public.friendships for select to authenticated
  using (auth.uid() in (user_a, user_b) and public.is_active(auth.uid()));
create policy "read own invites" on public.invite_codes for select to authenticated
  using (created_by = auth.uid() and public.is_active(auth.uid()));
create policy "read config" on public.app_config for select to authenticated
  using (public.is_active(auth.uid()));
