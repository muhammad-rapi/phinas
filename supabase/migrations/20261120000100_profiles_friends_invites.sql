-- Multi-user: profile fields, friends, invites, global switches, playlist visibility, registration.
-- RPCs raise 'phinas:<code>' so the app can show a precise message.

-- Internal helpers live in `private`, which PostgREST does not expose (only `public` is).
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- Short random codes without look-alike characters (no I, O, 0, 1).
create function private.gen_code(prefix text, len int) returns text
language sql volatile set search_path = public, private as $$
  select prefix || string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i - 1) % 32), 1), '' order by i)
  from (select extensions.gen_random_bytes(len) as b) r, generate_series(1, len) as i
$$;

alter table public.profiles
  add column role text not null default 'user' check (role in ('user', 'admin')),
  add column disabled boolean not null default false,
  add column friend_code text unique,
  add column accepted_terms_at timestamptz,
  add column invited_by uuid references public.profiles(id) on delete set null,
  add column listen_scope text not null default 'friends' check (listen_scope in ('friends', 'partner', 'off')),
  add column created_at timestamptz not null default now();

create index profiles_invited_by on public.profiles(invited_by);

create function private.new_friend_code() returns text
language plpgsql volatile set search_path = public, private as $$
declare c text;
begin
  loop
    c := gen_code('PHN-', 4);
    exit when not exists (select 1 from profiles where friend_code = c);
  end loop;
  return c;
end $$;

-- The existing accounts accepted the terms by using the app before they existed.
update public.profiles set
  friend_code = private.new_friend_code(),
  accepted_terms_at = now(),
  created_at = coalesce((select u.created_at from auth.users u where u.id = profiles.id), now());
alter table public.profiles alter column friend_code set not null;

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  requested_by uuid not null references public.profiles(id) on delete cascade,
  is_partner boolean not null default false,
  partner_requested_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  check (requested_by in (user_a, user_b)),
  check (not is_partner or status = 'accepted'),
  unique (user_a, user_b)
);
create index friendships_user_b on public.friendships(user_b);
create index friendships_requested_by on public.friendships(requested_by);
create index friendships_partner_requested_by on public.friendships(partner_requested_by);

-- A user can sit in either column, so "one partner per user" cannot be a unique index.
create function private.check_one_partner() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if new.is_partner then
    perform 1 from profiles where id in (new.user_a, new.user_b) order by id for no key update;
    if exists (
      select 1 from friendships f
      where f.is_partner and f.id <> new.id
        and (f.user_a in (new.user_a, new.user_b) or f.user_b in (new.user_a, new.user_b))
    ) then
      raise exception 'phinas:partner_taken';
    end if;
  end if;
  return new;
end $$;

create trigger friendships_one_partner
  before insert or update on public.friendships
  for each row execute function private.check_one_partner();

create table public.invite_codes (
  code text primary key,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_by uuid references public.profiles(id) on delete set null,
  used_at timestamptz,
  revoked boolean not null default false
);
create index invite_codes_created_by on public.invite_codes(created_by);
create index invite_codes_used_by on public.invite_codes(used_by);

create table public.app_config (
  key text primary key,
  value jsonb not null
);
insert into public.app_config (key, value) values
  ('listen_together_enabled', 'true'),
  ('registration_open', 'true'),
  ('invite_quota', '3');

-- Locked by default. Later migrations add select policies; RLS with no policy returns nothing.
alter table public.friendships enable row level security;
alter table public.invite_codes enable row level security;
alter table public.app_config enable row level security;
revoke all on public.friendships, public.invite_codes, public.app_config from anon, authenticated;
grant select on public.friendships, public.invite_codes, public.app_config to authenticated;

alter table public.playlists
  add column visibility text not null default 'friends' check (visibility in ('private', 'friends', 'public'));

-- Helpers. security definer so policies can call them without recursing through RLS.
create function private.is_active(uid uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (select 1 from profiles where id = uid and not disabled)
$$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and not disabled)
$$;

create function private.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1 from friendships
    where user_a = least(a, b) and user_b = greatest(a, b) and status = 'accepted'
  )
$$;

create function private.is_partner(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1 from friendships
    where user_a = least(a, b) and user_b = greatest(a, b) and status = 'accepted' and is_partner
  )
$$;

create function private.config(k text) returns jsonb
language sql stable security definer set search_path = public, private as $$
  select value from app_config where key = k
$$;

-- The caller's accepted friends whose accounts are active.
create function private.friend_ids() returns setof uuid
language sql stable security definer set search_path = public, private as $$
  select case when f.user_a = auth.uid() then f.user_b else f.user_a end
  from friendships f
  where f.status = 'accepted' and auth.uid() in (f.user_a, f.user_b)
    and is_active(case when f.user_a = auth.uid() then f.user_b else f.user_a end)
$$;

-- 'ok' or the reason a code cannot be used. Callable before sign-up (granted to anon later).
create function public.check_invite(p_code text) returns text
language sql stable security definer set search_path = public, private as $$
  select case
    when not coalesce((config('registration_open'))::boolean, false) then 'registration_closed'
    when i.code is null then 'invite_invalid'
    when i.revoked then 'invite_revoked'
    when not is_active(i.created_by) then 'invite_revoked'
    when i.used_at is not null then 'invite_used'
    when i.expires_at <= now() then 'invite_expired'
    else 'ok'
  end
  from (select 1) as one
  left join invite_codes i on i.code = upper(trim(coalesce(p_code, '')))
$$;

-- Registration gate. Any exception cancels the sign-up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_code text := upper(trim(coalesce(meta->>'invite_code', '')));
  v_name text := left(nullif(trim(coalesce(meta->>'display_name', '')), ''), 30);
  v_status text;
  v_inviter uuid;
begin
  if coalesce(meta->>'accepted_terms', 'false') <> 'true' then
    raise exception 'phinas:terms_required';
  end if;

  -- Bootstrap: the very first account needs no invite and becomes the admin.
  perform pg_advisory_xact_lock(hashtext('phinas:bootstrap'));
  if not exists (select 1 from profiles) then
    insert into profiles (id, display_name, role, friend_code, accepted_terms_at)
    values (new.id, coalesce(v_name, nullif(left(split_part(coalesce(new.email, ''), '@', 1), 30), ''), 'Phinas'), 'admin', new_friend_code(), now());
    return new;
  end if;

  perform 1 from invite_codes where code = v_code for update;
  v_status := check_invite(v_code);
  if v_status <> 'ok' then
    raise exception 'phinas:%', v_status;
  end if;
  select created_by into v_inviter from invite_codes where code = v_code;

  insert into profiles (id, display_name, friend_code, accepted_terms_at, invited_by)
  values (new.id, coalesce(v_name, nullif(left(split_part(coalesce(new.email, ''), '@', 1), 30), ''), 'Phinas'), new_friend_code(), now(), v_inviter);
  update invite_codes set used_by = new.id, used_at = now() where code = v_code;
  insert into friendships (user_a, user_b, status, requested_by)
  values (least(new.id, v_inviter), greatest(new.id, v_inviter), 'accepted', v_inviter);
  return new;
end $$;

-- The two accounts from the two-person era become friends and partners.
do $$
declare ids uuid[];
begin
  select array_agg(id order by id) into ids from public.profiles;
  if coalesce(array_length(ids, 1), 0) = 2 then
    insert into public.friendships (user_a, user_b, status, requested_by, is_partner)
    values (ids[1], ids[2], 'accepted', ids[1], true);
  end if;
end $$;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
