-- Initial two-account schema (already applied in production by hand; mark it applied with
-- `supabase migration repair --status applied 20261120000000` before the first `db push`).

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null
);

create table public.playlists (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null,
  updated_at timestamptz not null default now()
);

create table public.playlist_tracks (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  position int not null,
  video_id text not null,
  title text not null,
  artist text not null,
  cover_url text not null,
  duration_sec int not null,
  primary key (playlist_id, position)
);

create table public.liked_tracks (
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  video_id text not null,
  title text not null,
  artist text not null,
  cover_url text not null,
  duration_sec int not null,
  liked_at timestamptz not null default now(),
  primary key (owner_id, video_id)
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.liked_tracks enable row level security;

-- Only two accounts exist, so "partner" means any other signed-in user.
create policy "read profiles" on public.profiles for select to authenticated using (true);
create policy "read playlists" on public.playlists for select to authenticated using (true);
create policy "read playlist tracks" on public.playlist_tracks for select to authenticated using (true);
create policy "read likes" on public.liked_tracks for select to authenticated using (true);

create policy "write own playlists" on public.playlists for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "write own playlist tracks" on public.playlist_tracks for all to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.playlists p where p.id = playlist_id and p.owner_id = auth.uid()));
create policy "write own likes" on public.liked_tracks for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
