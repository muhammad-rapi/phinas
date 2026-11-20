# Multi-user Phinas (sub-project A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-account Supabase backend with invite-only multi-user: friends with an optional mutual partner, playlist visibility, server-enforced Listen Together permissions, admin RPCs, plus the desktop data layer and a minimal bridge UI.

**Architecture:** All rules live in Postgres: RLS for reads, a trigger on `auth.users` for registration, `security definer` RPCs (raising `phinas:<code>` errors) for every write that is not a plain own-row write. Realtime private channels are authorized by `can_join_topic(topic)`. The Electron main process wraps the RPCs in `SupabaseRemote`, caches social data for offline start, and exposes it over the existing typed IPC.

**Tech Stack:** Supabase (Postgres 15+, Auth, Realtime), Supabase CLI 3.2 on OrbStack, pgTAP, Electron 45, TypeScript, `node:sqlite`, Vitest 5, React 19.

**Spec:** `docs/superpowers/specs/2026-11-20-multi-user-design.md`

---

## File map

```
supabase/
  config.toml                                  created by `supabase init`
  migrations/
    20261120000000_initial.sql                 = old supabase/schema.sql (moved)
    20261120000100_profiles_friends_invites.sql tables, codes, helpers, registration
    20261120000200_access_rules.sql            RLS + column grants
    20261120000300_user_rpcs.sql               profile, friends, partner, invites, config, delete
    20261120000400_admin_rpcs.sql              admin_* functions
    20261120000500_realtime_auth.sql           can_join_topic + realtime.messages policies
    20261120000600_function_grants.sql         execute privileges
  tests/
    01_registration.test.sql
    02_access.test.sql
    03_friends.test.sql
    04_invites.test.sql
    05_admin.test.sql
    06_listen.test.sql
    07_grants.test.sql
src/shared/
  types.ts            + Visibility, ListenScope, MyProfile, Friend, FriendRequest, InviteCode, AppConfig, SignUpInput
  errors.ts           NEW  phinas:<code> -> Indonesian text
  links.ts            NEW  terms / privacy URLs
  ipc.ts              + new API methods and events
src/main/
  library/db.ts       + migrate() adds playlists.visibility
  library/library.ts  + visibility in reads, setVisibility()
  sync/cache.ts       NEW  CacheStore + withCache (offline start)
  sync/supabase-remote.ts  + signUp, RPC wrappers, visibility, friend/public playlists, partner-based pairInfo
  sync/realtime.ts    private pair channel, not-allowed state
  sync/presence.ts    NEW  PresenceHub (friends online)
  ipc.ts              + handlers
  index.ts            wiring
src/preload/index.ts  + events
src/renderer/src/screens/Profile.tsx   sign-up form, friend code, disabled notice, delete account
tests/
  errors.test.ts, library-visibility.test.ts, social-cache.test.ts, presence.test.ts  NEW
  sync-engine.test.ts  (FakeRemote gets visibility-aware types)
```

## pgTAP helper block

Every file in `supabase/tests/` starts with this exact block (each file runs in its own transaction and is rolled back, so helpers cannot be shared). It is referred to below as **HELPERS** and must be pasted in full, not referenced.

```sql
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
```

Every file ends with:

```sql
select * from finish();
rollback;
```

---

### Task 0: Local Supabase and the initial migration

**Files:**
- Create: `supabase/config.toml` (generated)
- Create: `supabase/migrations/20261120000000_initial.sql` (moved from `supabase/schema.sql`)
- Create: `supabase/tests/00_smoke.test.sql`

- [ ] **Step 1: Initialise the Supabase project folder**

Run: `cd /Users/mac/Dev/phinas-desktop && supabase init --force`
Expected: `Finished supabase init.` and `supabase/config.toml` exists. If it asks about VS Code / IntelliJ settings, answer `N`.

- [ ] **Step 2: Move the schema into a migration**

```bash
mkdir -p supabase/migrations supabase/tests
git mv supabase/schema.sql supabase/migrations/20261120000000_initial.sql
```

Then delete the first two comment lines of `20261120000000_initial.sql` (`-- Run once in the Supabase dashboard...` and `-- Do this BEFORE creating the two user accounts.`) and replace them with:

```sql
-- Initial two-account schema (already applied in production by hand; mark it applied with
-- `supabase migration repair --status applied 20261120000000` before the first `db push`).
```

- [ ] **Step 3: Write a smoke test**

`supabase/tests/00_smoke.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);
select has_table('public', 'profiles', 'profiles exists');
select has_function('public', 'handle_new_user', 'handle_new_user exists');
select * from finish();
rollback;
```

- [ ] **Step 4: Start a slim local stack**

The disk has about 10 GB free, so skip the services the tests do not need. Postgres, Auth (creates `auth.users`), Realtime (creates `realtime.messages`), PostgREST and Kong stay.

Run:
```bash
supabase start -x studio,imgproxy,storage-api,edge-runtime,logflare,vector,supavisor,mailpit,postgres-meta
```
Expected: `Started supabase local development setup.` with a `DB URL`. First run downloads images (a few minutes).

Run: `df -h / | tail -1` and confirm at least 3 GB remain. If not, stop and tell the user.

- [ ] **Step 5: Run the smoke test**

Run: `supabase test db`
Expected: `00_smoke.test.sql .. ok` and `Result: PASS`.

- [ ] **Step 6: Commit**

```bash
git add supabase
git commit -m "chore(supabase): local CLI project, schema as first migration

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Profiles, friendships, invites, config and registration

**Files:**
- Create: `supabase/migrations/20261120000100_profiles_friends_invites.sql`
- Test: `supabase/tests/01_registration.test.sql`

- [ ] **Step 1: Write the failing test**

`supabase/tests/01_registration.test.sql` = **HELPERS**, then:

```sql
select tests.new_user('admin');
select is((select role from public.profiles where id = tests.id('admin')), 'admin',
  'first user becomes admin without an invite');
select matches((select friend_code from public.profiles where id = tests.id('admin')), '^PHN-[A-Z2-9]{4}$',
  'friend code format');
select isnt((select accepted_terms_at from public.profiles where id = tests.id('admin')), null,
  'terms acceptance recorded');

select throws_ok($$ select tests.new_user('nocode') $$, 'P0001', 'phinas:invite_invalid',
  'later users need an invite');
select throws_ok($$ select tests.new_user('typo', 'NOPE2345') $$, 'P0001', 'phinas:invite_invalid',
  'unknown code is rejected');

select tests.invite('admin', 'c1');
select lives_ok($$ select tests.new_user('budi', tests.code('c1')) $$, 'a valid code registers');
select is((select role from public.profiles where id = tests.id('budi')), 'user', 'invitee is a normal user');
select is((select display_name from public.profiles where id = tests.id('budi')), 'budi', 'display name from metadata');
select is((select invited_by from public.profiles where id = tests.id('budi')), tests.id('admin'), 'invited_by recorded');
select ok(public.are_friends(tests.id('budi'), tests.id('admin')), 'invitee and inviter are friends');
select isnt((select used_at from public.invite_codes where code = tests.code('c1')), null, 'code marked used');
select throws_ok($$ select tests.new_user('cici', tests.code('c1')) $$, 'P0001', 'phinas:invite_used',
  'a code works once');

select tests.invite('admin', 'c2');
update public.invite_codes set expires_at = now() - interval '1 minute' where code = tests.code('c2');
select throws_ok($$ select tests.new_user('dedi', tests.code('c2')) $$, 'P0001', 'phinas:invite_expired',
  'expired code');

select tests.invite('admin', 'c3');
update public.invite_codes set revoked = true where code = tests.code('c3');
select throws_ok($$ select tests.new_user('eko', tests.code('c3')) $$, 'P0001', 'phinas:invite_revoked',
  'revoked code');

select tests.invite('admin', 'c4');
select throws_ok($$ select tests.new_user('fani', tests.code('c4'), false) $$, 'P0001', 'phinas:terms_required',
  'terms must be accepted');

update public.app_config set value = 'false' where key = 'registration_open';
select throws_ok($$ select tests.new_user('gita', tests.code('c4')) $$, 'P0001', 'phinas:registration_closed',
  'registration can be closed');
select is(public.check_invite(tests.code('c4')), 'registration_closed', 'check_invite reports closed');
update public.app_config set value = 'true' where key = 'registration_open';

select is(public.check_invite(lower(tests.code('c4'))), 'ok', 'check_invite ignores case');
select is(public.check_invite('  ' || tests.code('c4') || ' '), 'ok', 'check_invite trims spaces');
select is(public.check_invite('nope'), 'invite_invalid', 'check_invite: unknown');
select is(public.check_invite(tests.code('c1')), 'invite_used', 'check_invite: used');

select is((select value from public.app_config where key = 'invite_quota'), '3'::jsonb, 'default quota');
select is((select value from public.app_config where key = 'listen_together_enabled'), 'true'::jsonb,
  'listen together on by default');
select has_column('public', 'playlists', 'visibility', 'playlists have visibility');

-- One partner per user.
select tests.invite('admin', 'c5');
select tests.new_user('hana', tests.code('c5'));
update public.friendships set is_partner = true where id = tests.fid('admin', 'budi');
select throws_ok($$ update public.friendships set is_partner = true where id = tests.fid('admin', 'hana') $$,
  'P0001', 'phinas:partner_taken', 'a user cannot have two partners');
```

Then the footer.

- [ ] **Step 2: Run it to verify it fails**

Run: `supabase test db`
Expected: `01_registration.test.sql` FAILS (e.g. `column "role" does not exist` or `relation "public.invite_codes" does not exist`).

- [ ] **Step 3: Write the migration**

`supabase/migrations/20261120000100_profiles_friends_invites.sql`:

```sql
-- Multi-user: profile fields, friends, invites, global switches, playlist visibility, registration.
-- RPCs raise 'phinas:<code>' so the app can show a precise message.

-- Short random codes without look-alike characters (no I, O, 0, 1).
create function public.gen_code(prefix text, len int) returns text
language sql volatile set search_path = public as $$
  select prefix || string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, len)
$$;

alter table public.profiles
  add column role text not null default 'user' check (role in ('user', 'admin')),
  add column disabled boolean not null default false,
  add column friend_code text unique,
  add column accepted_terms_at timestamptz,
  add column invited_by uuid references public.profiles(id) on delete set null,
  add column listen_scope text not null default 'friends' check (listen_scope in ('friends', 'partner', 'off')),
  add column created_at timestamptz not null default now();

create function public.new_friend_code() returns text
language plpgsql volatile set search_path = public as $$
declare c text;
begin
  loop
    c := gen_code('PHN-', 4);
    exit when not exists (select 1 from profiles where friend_code = c);
  end loop;
  return c;
end $$;

-- The existing accounts accepted the terms by using the app before they existed.
update public.profiles set friend_code = public.new_friend_code(), accepted_terms_at = now();
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

-- A user can sit in either column, so "one partner per user" cannot be a unique index.
create function public.check_one_partner() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.is_partner then
    perform 1 from profiles where id in (new.user_a, new.user_b) order by id for update;
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
  before insert or update of is_partner on public.friendships
  for each row execute function public.check_one_partner();

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

create table public.app_config (
  key text primary key,
  value jsonb not null
);
insert into public.app_config (key, value) values
  ('listen_together_enabled', 'true'),
  ('registration_open', 'true'),
  ('invite_quota', '3');

alter table public.playlists
  add column visibility text not null default 'friends' check (visibility in ('private', 'friends', 'public'));

-- Helpers. security definer so policies can call them without recursing through RLS.
create function public.is_active(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = uid and not disabled)
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and not disabled)
$$;

create function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where user_a = least(a, b) and user_b = greatest(a, b) and status = 'accepted'
  )
$$;

create function public.is_partner(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where user_a = least(a, b) and user_b = greatest(a, b) and status = 'accepted' and is_partner
  )
$$;

create function public.config(k text) returns jsonb
language sql stable security definer set search_path = public as $$
  select value from app_config where key = k
$$;

-- 'ok' or the reason a code cannot be used. Callable before sign-up (granted to anon later).
create function public.check_invite(p_code text) returns text
language sql stable security definer set search_path = public as $$
  select case
    when not coalesce((config('registration_open'))::boolean, false) then 'registration_closed'
    when i.code is null then 'invite_invalid'
    when i.revoked then 'invite_revoked'
    when i.used_at is not null then 'invite_used'
    when i.expires_at <= now() then 'invite_expired'
    else 'ok'
  end
  from (select 1) as one
  left join invite_codes i on i.code = upper(trim(coalesce(p_code, '')))
$$;

-- Registration gate. Any exception cancels the sign-up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
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
  if not exists (select 1 from profiles) then
    insert into profiles (id, display_name, role, friend_code, accepted_terms_at)
    values (new.id, coalesce(v_name, split_part(new.email, '@', 1)), 'admin', new_friend_code(), now());
    return new;
  end if;

  perform 1 from invite_codes where code = v_code for update;
  v_status := check_invite(v_code);
  if v_status <> 'ok' then
    raise exception 'phinas:%', v_status;
  end if;
  select created_by into v_inviter from invite_codes where code = v_code;

  insert into profiles (id, display_name, friend_code, accepted_terms_at, invited_by)
  values (new.id, coalesce(v_name, split_part(new.email, '@', 1)), new_friend_code(), now(), v_inviter);
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
```

- [ ] **Step 4: Apply and run the tests**

Run: `supabase db reset && supabase test db`
Expected: `00_smoke` and `01_registration` pass, `Result: PASS`.

If `supabase db reset` says the container restarted services, wait for it to finish; it re-applies every migration.

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat(supabase): profiles, friendships, invite-only registration

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Access rules (RLS and column grants)

**Files:**
- Create: `supabase/migrations/20261120000200_access_rules.sql`
- Test: `supabase/tests/02_access.test.sql`

- [ ] **Step 1: Write the failing test**

`supabase/tests/02_access.test.sql` = **HELPERS**, then:

```sql
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

-- A stranger.
select tests.login('sari');
set local role authenticated;
select results_eq($$ select name from public.playlists order by name $$, array['pub'],
  'a stranger sees public playlists only');
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

-- A disabled account reads nothing.
update public.profiles set disabled = true where id = tests.id('admin');
select tests.login('admin');
set local role authenticated;
select is((select count(*)::int from public.playlists), 0, 'disabled: no playlists');
select is((select count(*)::int from public.liked_tracks), 0, 'disabled: no likes');
select is((select count(*)::int from public.app_config), 0, 'disabled: no config');
reset role;
```

Then the footer.

- [ ] **Step 2: Run it to verify it fails**

Run: `supabase test db`
Expected: `02_access.test.sql` FAILS (the old `using (true)` policies let the stranger see `fr`, and `role` is readable).

- [ ] **Step 3: Write the migration**

`supabase/migrations/20261120000200_access_rules.sql`:

```sql
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
```

- [ ] **Step 4: Apply and run the tests**

Run: `supabase db reset && supabase test db`
Expected: all files pass.

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat(supabase): friend-based access rules and column grants

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: User RPCs (profile, friends, partner, invites, config, delete)

**Files:**
- Create: `supabase/migrations/20261120000300_user_rpcs.sql`
- Test: `supabase/tests/03_friends.test.sql`, `supabase/tests/04_invites.test.sql`

- [ ] **Step 1: Write the failing friends test**

`supabase/tests/03_friends.test.sql` = **HELPERS**, then:

```sql
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
```

Then the footer.

- [ ] **Step 2: Write the failing invites test**

`supabase/tests/04_invites.test.sql` = **HELPERS**, then:

```sql
select tests.new_user('admin');
select tests.new_user('budi', tests.invite('admin', 'b'));

select tests.login('budi');
set local role authenticated;
select is((public.my_profile()->>'invitesLeft')::int, 3, 'three invites to start');
select matches(public.create_invite(), '^[A-Z2-9]{8}$', 'code format');
select lives_ok($$ select public.create_invite() $$, 'second');
select lives_ok($$ select public.create_invite() $$, 'third');
select is((public.my_profile()->>'invitesLeft')::int, 0, 'none left');
select throws_ok($$ select public.create_invite() $$, 'P0001', 'phinas:quota_exceeded', 'quota reached');
select is(jsonb_array_length(public.list_my_invites()), 3, 'list my invites');

select lives_ok($$ select public.revoke_invite(public.list_my_invites()->0->>'code') $$, 'revoke an open code');
select lives_ok($$ select public.create_invite() $$, 'a revoked unused code frees a slot');
select throws_ok($$ select public.revoke_invite('ZZZZZZZZ') $$, 'P0001', 'phinas:invite_invalid', 'unknown code');
reset role;

-- Use one of budi's open codes; used codes keep counting.
select tests.new_user('cici', (
  select code from public.invite_codes
  where created_by = tests.id('budi') and not revoked and used_at is null
  order by created_at limit 1));
select tests.login('budi');
set local role authenticated;
select throws_ok($$ select public.create_invite() $$, 'P0001', 'phinas:quota_exceeded', 'used codes still count');
select throws_ok($$ select public.revoke_invite((select code from public.invite_codes where used_by = tests.id('cici'))) $$,
  'P0001', 'phinas:invite_invalid', 'a used code cannot be revoked');
select is((select i->>'usedByName' from jsonb_array_elements(public.list_my_invites()) i where i->>'usedAt' is not null),
  'cici', 'list shows who used a code');
reset role;

select tests.login('cici');
set local role authenticated;
select is(jsonb_array_length(public.list_my_invites()), 0, 'cici sees only her own codes');
reset role;

-- Admins have no quota.
select tests.login('admin');
set local role authenticated;
select is(public.my_profile()->'invitesLeft', 'null'::jsonb, 'admin has no limit');
select lives_ok($$ select count(public.create_invite()) from generate_series(1, 5) $$, 'admin creates many');
reset role;

-- Quota 0 closes invites for users.
update public.app_config set value = '0' where key = 'invite_quota';
select tests.login('cici');
set local role authenticated;
select throws_ok($$ select public.create_invite() $$, 'P0001', 'phinas:quota_exceeded', 'quota 0');
reset role;
```

Then the footer.

- [ ] **Step 3: Run them to verify they fail**

Run: `supabase test db`
Expected: `03_friends` and `04_invites` FAIL with `function public.send_friend_request(unknown) does not exist` / `function public.create_invite() does not exist`.

- [ ] **Step 4: Write the migration**

`supabase/migrations/20261120000300_user_rpcs.sql`:

```sql
-- RPCs for signed-in users. All raise 'phinas:<code>' on refusal.

create function private.require_signed_in() returns uuid
language plpgsql stable security definer set search_path = public, private as $$
begin
  if auth.uid() is null then raise exception 'phinas:not_signed_in'; end if;
  return auth.uid();
end $$;

create function private.require_active() returns uuid
language plpgsql stable security definer set search_path = public, private as $$
declare u uuid := require_signed_in();
begin
  if not is_active(u) then raise exception 'phinas:account_disabled'; end if;
  return u;
end $$;

-- Listen Together permission, from one side: does `owner` allow `other`?
create function private.scope_allows(owner uuid, other uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select case (select listen_scope from profiles where id = owner)
    when 'friends' then are_friends(owner, other)
    when 'partner' then is_partner(owner, other)
    else false
  end
$$;

create function private.can_listen(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select a <> b
    and coalesce((config('listen_together_enabled'))::boolean, false)
    and is_active(a) and is_active(b)
    and scope_allows(a, b) and scope_allows(b, a)
$$;

create function private.invites_left(u uuid) returns int
language sql stable security definer set search_path = public, private as $$
  select case
    when (select role from profiles where id = u) = 'admin' then null
    else greatest(0, coalesce((config('invite_quota'))::int, 0) - (
      select count(*)::int from invite_codes
      where created_by = u and (used_at is not null or (not revoked and expires_at > now()))
    ))
  end
$$;

-- Readable even when disabled, so the app can say so.
create function public.my_profile() returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare u uuid := require_signed_in();
begin
  return (
    select jsonb_build_object(
      'id', p.id, 'displayName', p.display_name, 'role', p.role, 'disabled', p.disabled,
      'friendCode', p.friend_code, 'listenScope', p.listen_scope, 'invitesLeft', invites_left(p.id))
    from profiles p where p.id = u
  );
end $$;

create function public.update_my_profile(p_display_name text, p_listen_scope text) returns void
language plpgsql security definer set search_path = public, private as $$
declare
  u uuid := require_active();
  v_name text := trim(p_display_name);
begin
  if p_display_name is not null and (v_name = '' or length(v_name) > 30) then
    raise exception 'phinas:name_invalid';
  end if;
  if p_listen_scope is not null and p_listen_scope not in ('friends', 'partner', 'off') then
    raise exception 'phinas:scope_invalid';
  end if;
  update profiles set
    display_name = coalesce(v_name, display_name),
    listen_scope = coalesce(p_listen_scope, listen_scope)
  where id = u;
end $$;

create function public.get_config() returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
begin
  perform require_active();
  return jsonb_build_object(
    'listenTogetherEnabled', coalesce((config('listen_together_enabled'))::boolean, false),
    'registrationOpen', coalesce((config('registration_open'))::boolean, false),
    'inviteQuota', coalesce((config('invite_quota'))::int, 0));
end $$;

-- Accepted friends, partner first. canListen already applies both scopes and the global switch.
create function public.list_friends() returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare u uuid := require_active();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'friendshipId', f.id,
      'userId', o.id,
      'name', o.display_name,
      'isPartner', f.is_partner,
      'partnerRequest', case
        when f.partner_requested_by is null then null
        when f.partner_requested_by = u then 'outgoing'
        else 'incoming' end,
      'canListen', can_listen(u, o.id)
    ) order by f.is_partner desc, lower(o.display_name))
    from friendships f
    join profiles o on o.id = case when f.user_a = u then f.user_b else f.user_a end
    where f.status = 'accepted' and u in (f.user_a, f.user_b) and not o.disabled
  ), '[]'::jsonb);
end $$;

create function public.list_friend_requests() returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare u uuid := require_active();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'friendshipId', f.id, 'userId', o.id, 'name', o.display_name, 'incoming', f.requested_by <> u
    ) order by f.created_at desc)
    from friendships f
    join profiles o on o.id = case when f.user_a = u then f.user_b else f.user_a end
    where f.status = 'pending' and u in (f.user_a, f.user_b) and not o.disabled
  ), '[]'::jsonb);
end $$;

create function public.send_friend_request(p_friend_code text) returns uuid
language plpgsql security definer set search_path = public, private as $$
declare
  u uuid := require_active();
  v_other uuid;
  f friendships;
begin
  select id into v_other from profiles
  where friend_code = upper(trim(coalesce(p_friend_code, ''))) and not disabled;
  if v_other is null then raise exception 'phinas:friend_code_invalid'; end if;
  if v_other = u then raise exception 'phinas:self_friend'; end if;

  select * into f from friendships where user_a = least(u, v_other) and user_b = greatest(u, v_other) for update;
  if found then
    if f.status = 'accepted' then raise exception 'phinas:already_friends'; end if;
    -- They already asked us: entering their code accepts it.
    if f.requested_by <> u then
      update friendships set status = 'accepted' where id = f.id;
    end if;
    return f.id;
  end if;

  insert into friendships (user_a, user_b, requested_by)
  values (least(u, v_other), greatest(u, v_other), u)
  returning id into f.id;
  return f.id;
end $$;

create function public.respond_friend_request(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public, private as $$
declare u uuid := require_active();
begin
  perform 1 from friendships
  where id = p_id and status = 'pending' and u in (user_a, user_b) and requested_by <> u
  for update;
  if not found then raise exception 'phinas:request_not_found'; end if;
  if p_accept then
    update friendships set status = 'accepted' where id = p_id;
  else
    delete from friendships where id = p_id;
  end if;
end $$;

-- Also cancels an outgoing request.
create function public.remove_friend(p_id uuid) returns void
language plpgsql security definer set search_path = public, private as $$
declare u uuid := require_active();
begin
  delete from friendships where id = p_id and u in (user_a, user_b);
  if not found then raise exception 'phinas:request_not_found'; end if;
end $$;

create function public.request_partner(p_id uuid) returns void
language plpgsql security definer set search_path = public, private as $$
declare
  u uuid := require_active();
  f friendships;
begin
  select * into f from friendships
  where id = p_id and status = 'accepted' and u in (user_a, user_b) for update;
  if not found then raise exception 'phinas:request_not_found'; end if;
  if f.is_partner then return; end if;
  if exists (
    select 1 from friendships x
    where x.is_partner and (x.user_a in (f.user_a, f.user_b) or x.user_b in (f.user_a, f.user_b))
  ) then
    raise exception 'phinas:partner_taken';
  end if;
  if f.partner_requested_by is not null and f.partner_requested_by <> u then
    -- They asked first: asking back accepts.
    update friendships set is_partner = true, partner_requested_by = null where id = p_id;
  else
    update friendships set partner_requested_by = u where id = p_id;
  end if;
end $$;

create function public.respond_partner(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public, private as $$
declare u uuid := require_active();
begin
  perform 1 from friendships
  where id = p_id and u in (user_a, user_b) and partner_requested_by is not null and partner_requested_by <> u
  for update;
  if not found then raise exception 'phinas:request_not_found'; end if;
  if p_accept then
    update friendships set is_partner = true, partner_requested_by = null where id = p_id;
  else
    update friendships set partner_requested_by = null where id = p_id;
  end if;
end $$;

create function public.end_partner(p_id uuid) returns void
language plpgsql security definer set search_path = public, private as $$
declare u uuid := require_active();
begin
  update friendships set is_partner = false, partner_requested_by = null
  where id = p_id and u in (user_a, user_b);
  if not found then raise exception 'phinas:request_not_found'; end if;
end $$;

create function public.create_invite() returns text
language plpgsql security definer set search_path = public, private as $$
declare
  u uuid := require_active();
  v_code text;
begin
  perform 1 from profiles where id = u for update; -- serialise quota checks per user
  if coalesce(invites_left(u), 1) <= 0 then raise exception 'phinas:quota_exceeded'; end if;
  loop
    v_code := gen_code('', 8);
    exit when not exists (select 1 from invite_codes where code = v_code);
  end loop;
  insert into invite_codes (code, created_by) values (v_code, u);
  return v_code;
end $$;

create function public.revoke_invite(p_code text) returns void
language plpgsql security definer set search_path = public, private as $$
declare u uuid := require_active();
begin
  update invite_codes set revoked = true
  where code = upper(trim(coalesce(p_code, ''))) and created_by = u and used_at is null;
  if not found then raise exception 'phinas:invite_invalid'; end if;
end $$;

create function public.list_my_invites() returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare u uuid := require_active();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'code', i.code, 'createdAt', i.created_at, 'expiresAt', i.expires_at,
      'usedAt', i.used_at, 'usedByName', p.display_name, 'revoked', i.revoked
    ) order by i.created_at desc)
    from invite_codes i left join profiles p on p.id = i.used_by
    where i.created_by = u
  ), '[]'::jsonb);
end $$;

-- Deletes the auth user; profiles, friendships, playlists, likes and invites cascade.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, private as $$
declare u uuid := require_signed_in();
begin
  delete from auth.users where id = u;
end $$;
```

- [ ] **Step 5: Apply and run the tests**

Run: `supabase db reset && supabase test db`
Expected: all files pass.

- [ ] **Step 6: Commit**

```bash
git add supabase
git commit -m "feat(supabase): friend, partner, invite and profile RPCs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Admin RPCs

**Files:**
- Create: `supabase/migrations/20261120000400_admin_rpcs.sql`
- Test: `supabase/tests/05_admin.test.sql`

- [ ] **Step 1: Write the failing test**

`supabase/tests/05_admin.test.sql` = **HELPERS**, then:

```sql
select tests.new_user('admin');
select tests.new_user('budi', tests.invite('admin', 'b'));

select tests.login('budi');
set local role authenticated;
select throws_ok($$ select public.admin_list_users() $$, 'P0001', 'phinas:not_admin', 'list users: admin only');
select throws_ok($$ select public.admin_list_invites() $$, 'P0001', 'phinas:not_admin', 'list invites: admin only');
select throws_ok($$ select public.admin_set_disabled(tests.id('admin'), true) $$, 'P0001', 'phinas:not_admin',
  'disable: admin only');
select throws_ok($$ select public.admin_set_config('registration_open', 'false') $$, 'P0001', 'phinas:not_admin',
  'config: admin only');
reset role;

select tests.login('admin');
set local role authenticated;
select is(jsonb_array_length(public.admin_list_users()), 2, 'admin sees every user');
select is((select u->>'email' from jsonb_array_elements(public.admin_list_users()) u where u->>'displayName' = 'budi'),
  'budi@test.local', 'email included');
select is((select u->>'invitedByName' from jsonb_array_elements(public.admin_list_users()) u where u->>'displayName' = 'budi'),
  'admin', 'inviter included');
select is((select (u->>'friendCount')::int from jsonb_array_elements(public.admin_list_users()) u where u->>'displayName' = 'budi'),
  1, 'friend count included');
select is(jsonb_array_length(public.admin_list_invites()), 1, 'admin sees every invite');
select is(public.admin_list_invites()->0->>'createdByName', 'admin', 'invite creator name');
select is(public.admin_list_invites()->0->>'usedByName', 'budi', 'invite user name');
select throws_ok($$ select public.admin_set_disabled(tests.id('admin'), true) $$, 'P0001', 'phinas:self_disable',
  'admin cannot disable themselves');
select lives_ok($$ select public.admin_set_disabled(tests.id('budi'), true) $$, 'disable budi');
select throws_ok($$ select public.admin_set_config('nope', 'true') $$, 'P0001', 'phinas:config_unknown', 'unknown key');
select lives_ok($$ select public.admin_set_config('listen_together_enabled', 'false') $$, 'switch listen off');
reset role;

select ok((select disabled from public.profiles where id = tests.id('budi')), 'budi is disabled');
select is((select value from public.app_config where key = 'listen_together_enabled'), 'false'::jsonb, 'switch stored');

-- A disabled user still reads their own profile, but cannot act.
select tests.login('budi');
set local role authenticated;
select is((public.my_profile()->>'disabled')::boolean, true, 'disabled user sees the flag');
select throws_ok($$ select public.create_invite() $$, 'P0001', 'phinas:account_disabled', 'disabled user cannot act');
reset role;

-- Delete account cascades.
update public.profiles set disabled = false where id = tests.id('budi');
select tests.login('budi');
set local role authenticated;
select lives_ok($$ select public.delete_my_account() $$, 'delete my account');
reset role;
select is((select count(*)::int from auth.users where id = tests.id('budi')), 0, 'auth user gone');
select is((select count(*)::int from public.profiles where id = tests.id('budi')), 0, 'profile gone');
select is((select count(*)::int from public.friendships), 0, 'friendships gone');
```

Then the footer.

- [ ] **Step 2: Run it to verify it fails**

Run: `supabase test db`
Expected: `05_admin` FAILS with `function public.admin_list_users() does not exist`.

- [ ] **Step 3: Write the migration**

`supabase/migrations/20261120000400_admin_rpcs.sql`:

```sql
-- Admin panel RPCs. Each checks is_admin(); none needs the service-role key.

create function private.require_admin() returns uuid
language plpgsql stable security definer set search_path = private, public as $$
begin
  if not is_admin() then raise exception 'phinas:not_admin'; end if;
  return auth.uid();
end $$;

create function public.admin_list_users() returns jsonb
language plpgsql stable security definer set search_path = private, public, auth as $$
begin
  perform require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'email', u.email,
      'displayName', p.display_name,
      'role', p.role,
      'disabled', p.disabled,
      'createdAt', u.created_at,
      'lastSignInAt', u.last_sign_in_at,
      'invitedByName', inv.display_name,
      'friendCount', (
        select count(*)::int from public.friendships f
        where f.status = 'accepted' and p.id in (f.user_a, f.user_b))
    ) order by u.created_at desc)
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.profiles inv on inv.id = p.invited_by
  ), '[]'::jsonb);
end $$;

create function public.admin_list_invites() returns jsonb
language plpgsql stable security definer set search_path = private, public as $$
begin
  perform require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'code', i.code,
      'createdByName', c.display_name,
      'createdAt', i.created_at,
      'expiresAt', i.expires_at,
      'usedByName', u.display_name,
      'usedAt', i.used_at,
      'revoked', i.revoked
    ) order by i.created_at desc)
    from invite_codes i
    join profiles c on c.id = i.created_by
    left join profiles u on u.id = i.used_by
  ), '[]'::jsonb);
end $$;

create function public.admin_set_disabled(p_user uuid, p_disabled boolean) returns void
language plpgsql security definer set search_path = private, public as $$
declare me uuid := require_admin();
begin
  if p_user = me then raise exception 'phinas:self_disable'; end if;
  update profiles set disabled = p_disabled where id = p_user;
end $$;

create function public.admin_set_config(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = private, public as $$
begin
  perform require_admin();
  update app_config set value = p_value where key = p_key;
  if not found then raise exception 'phinas:config_unknown'; end if;
end $$;
```

- [ ] **Step 4: Apply and run the tests**

Run: `supabase db reset && supabase test db`
Expected: all files pass.

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat(supabase): admin RPCs for the admin panel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Realtime authorization for Listen Together

**Files:**
- Create: `supabase/migrations/20261120000500_realtime_auth.sql`
- Test: `supabase/tests/06_listen.test.sql`

- [ ] **Step 1: Write the failing test**

`supabase/tests/06_listen.test.sql` = **HELPERS**, then:

```sql
-- admin is friends with budi and sari; budi and sari are partners; tono is only sari's friend.
select tests.new_user('admin');
select tests.new_user('budi', tests.invite('admin', 'b'));
select tests.new_user('sari', tests.invite('admin', 's'));
select tests.befriend('budi', 'sari');
update public.friendships set is_partner = true where id = tests.fid('budi', 'sari');
select tests.new_user('tono', tests.invite('sari', 't'));

select tests.login('budi');
set local role authenticated;
select ok(private.can_join_topic(tests.pair('budi', 'sari')), 'partners can join their pair');
select ok(private.can_join_topic(tests.pair('budi', 'admin')), 'friends can join with scope friends');
select ok(not private.can_join_topic(tests.pair('sari', 'admin')), 'cannot join a pair you are not in');
select ok(not private.can_join_topic('pair:' || greatest(tests.id('budi'), tests.id('sari')) || ':'
  || least(tests.id('budi'), tests.id('sari'))), 'unsorted pair topic is rejected');
select ok(not private.can_join_topic('pair:garbage:x'), 'malformed topic is rejected');
select ok(not private.can_join_topic('something-else'), 'unknown topic is rejected');
select ok(private.can_join_topic('presence:' || tests.id('budi')), 'own presence channel');
select ok(private.can_join_topic('presence:' || tests.id('sari')), 'a friend''s presence channel');
reset role;

select tests.login('tono');
set local role authenticated;
select ok(not private.can_join_topic('presence:' || tests.id('budi')), 'strangers cannot watch presence');
select ok(not private.can_join_topic(tests.pair('tono', 'budi')), 'strangers cannot pair');
reset role;

-- Scope 'partner' blocks other friends but not the partner.
update public.profiles set listen_scope = 'partner' where id = tests.id('budi');
select tests.login('admin');
set local role authenticated;
select ok(not private.can_join_topic(tests.pair('admin', 'budi')), 'partner-only scope blocks a friend');
reset role;
select tests.login('sari');
set local role authenticated;
select ok(private.can_join_topic(tests.pair('budi', 'sari')), 'partner-only scope allows the partner');
reset role;

-- Scope 'off' on either side blocks.
update public.profiles set listen_scope = 'off' where id = tests.id('sari');
select tests.login('budi');
set local role authenticated;
select ok(not private.can_join_topic(tests.pair('budi', 'sari')), 'the other side being off blocks');
reset role;
update public.profiles set listen_scope = 'friends' where id in (tests.id('budi'), tests.id('sari'));

-- Global switch.
update public.app_config set value = 'false' where key = 'listen_together_enabled';
select tests.login('budi');
set local role authenticated;
select ok(not private.can_join_topic(tests.pair('budi', 'sari')), 'global switch off blocks every pair');
select ok(private.can_join_topic('presence:' || tests.id('sari')), 'presence still works');
select is((select f->>'canListen' from jsonb_array_elements(public.list_friends()) f where f->>'name' = 'sari'),
  'false', 'list_friends reflects the switch');
reset role;
update public.app_config set value = 'true' where key = 'listen_together_enabled';

-- A disabled side blocks.
update public.profiles set disabled = true where id = tests.id('sari');
select tests.login('budi');
set local role authenticated;
select ok(not private.can_join_topic(tests.pair('budi', 'sari')), 'a disabled side blocks');
select ok(not private.can_join_topic('presence:' || tests.id('sari')), 'no presence of a disabled user');
reset role;

select ok(
  to_regclass('realtime.messages') is null
  or exists (select 1 from pg_policies where schemaname = 'realtime' and tablename = 'messages'
             and policyname = 'phinas join'),
  'realtime policies are installed when Realtime exists');
```

Then the footer.

- [ ] **Step 2: Run it to verify it fails**

Run: `supabase test db`
Expected: `06_listen` FAILS with `function private.can_join_topic(text) does not exist`.

- [ ] **Step 3: Write the migration**

`supabase/migrations/20261120000500_realtime_auth.sql`:

```sql
-- Private Realtime channels for Listen Together.
--   pair:<uuidA>:<uuidB>  (A < B)  one session between two friends
--   presence:<uuid>                 the owner tracks presence; friends watch it

create function private.can_join_topic(p_topic text) returns boolean
language plpgsql stable security definer set search_path = private, public as $$
declare
  u uuid := auth.uid();
  parts text[] := string_to_array(coalesce(p_topic, ''), ':');
  a uuid;
  b uuid;
begin
  if u is null then return false; end if;
  begin
    if parts[1] = 'pair' and array_length(parts, 1) = 3 then
      a := parts[2]::uuid;
      b := parts[3]::uuid;
      return a < b and u in (a, b) and can_listen(a, b);
    elsif parts[1] = 'presence' and array_length(parts, 1) = 2 then
      a := parts[2]::uuid;
      return is_active(u) and is_active(a) and (a = u or are_friends(u, a));
    end if;
  exception when invalid_text_representation then
    return false;
  end;
  return false;
end $$;

-- realtime.messages is created by the Realtime service. Skip on a stack without it.
do $$
begin
  if to_regclass('realtime.messages') is null then
    raise notice 'realtime.messages not found; Listen Together policies skipped';
    return;
  end if;
  execute $p$
    create policy "phinas join" on realtime.messages for select to authenticated
    using (private.can_join_topic(realtime.topic()))
  $p$;
  -- Anyone in a pair may send; on a presence channel only the owner tracks.
  execute $p$
    create policy "phinas send" on realtime.messages for insert to authenticated
    with check (
      private.can_join_topic(realtime.topic())
      and (realtime.topic() like 'pair:%' or realtime.topic() = 'presence:' || auth.uid()::text)
    )
  $p$;
end $$;
```

- [ ] **Step 4: Apply and run the tests**

Run: `supabase db reset && supabase test db`
Expected: all files pass. In the reset output, there should be NO notice `Listen Together policies skipped` (Realtime is running). If it appears, run `supabase db reset` once more after `supabase status` shows realtime healthy, and re-run the tests: the last check of `06_listen` must pass with the policy present.

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat(supabase): authorize private Listen Together channels

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Function execute privileges

Postgres grants `EXECUTE` on new functions to `PUBLIC`, and Supabase also grants it to `anon`. Only `check_invite` should be callable before sign-in.

**Files:**
- Create: `supabase/migrations/20261120000600_function_grants.sql`
- Test: `supabase/tests/07_grants.test.sql`

- [ ] **Step 1: Write the failing test**

`supabase/tests/07_grants.test.sql` = **HELPERS**, then:

```sql
select tests.new_user('admin');
select set_config('request.jwt.claims', '', true);
set local role anon;
select is(public.check_invite('nope'), 'invite_invalid', 'anon can check an invite');
select throws_ok($$ select public.create_invite() $$, '42501', null, 'anon cannot create invites');
select throws_ok($$ select public.admin_list_users() $$, '42501', null, 'anon cannot list users');
select throws_ok($$ select public.my_profile() $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select public.delete_my_account() $$, '42501', null, 'anon cannot delete accounts');
select ok(not has_function_privilege('anon', 'private.can_join_topic(text)', 'execute'), 'anon cannot run private helpers');
reset role;

select tests.login('admin');
set local role authenticated;
select lives_ok($$ select public.my_profile() $$, 'authenticated can call RPCs');
select lives_ok($$ select public.check_invite('x') $$, 'authenticated can check invites');
reset role;
```

Then the footer.

- [ ] **Step 2: Run it to verify it fails**

Run: `supabase test db`
Expected: `07_grants` FAILS: `anon cannot create invites` gets `P0001 phinas:not_signed_in` instead of `42501`.

- [ ] **Step 3: Write the migration**

`supabase/migrations/20261120000600_function_grants.sql`:

```sql
-- Only signed-in users call RPCs; check_invite is the single pre-sign-up exception.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
grant execute on function public.check_invite(text) to anon;

-- Internal helpers live in the non-exposed private schema; policies still need them as authenticated.
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

-- Future functions created by postgres start closed to anon as well.
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;
alter default privileges for role postgres in schema private revoke execute on functions from public, anon;
```

- [ ] **Step 4: Apply and run the tests**

Run: `supabase db reset && supabase test db`
Expected: all eight files pass, `Result: PASS`.

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat(supabase): lock RPC execute to signed-in users

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Shared types, error messages and legal links

**Files:**
- Modify: `src/shared/types.ts`
- Create: `src/shared/errors.ts`, `src/shared/links.ts`
- Test: `tests/errors.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/errors.test.ts`:

```ts
import { expect, test } from 'vitest'
import { friendlyError } from '../src/shared/errors'

test('maps a phinas code to Indonesian text', () => {
  expect(friendlyError(new Error('phinas:invite_used'))).toBe('Kode undangan ini sudah dipakai.')
})

test('finds the code inside an Electron IPC error', () => {
  const e = new Error("Error invoking remote method 'syncSignUp': Error: phinas:quota_exceeded")
  expect(friendlyError(e)).toBe('Jatah kode undanganmu sudah habis.')
})

test('unknown phinas codes get a generic message', () => {
  expect(friendlyError(new Error('phinas:something_new'))).toBe('Terjadi kesalahan. Coba lagi.')
})

test('other errors keep their text without the IPC prefix', () => {
  const e = new Error("Error invoking remote method 'syncSignIn': Error: Invalid login credentials")
  expect(friendlyError(e)).toBe('Invalid login credentials')
})

test('non-Error values', () => {
  expect(friendlyError('boom')).toBe('boom')
  expect(friendlyError(undefined)).toBe('Terjadi kesalahan. Coba lagi.')
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/errors.test.ts`
Expected: FAIL, `Cannot find module '../src/shared/errors'`.

- [ ] **Step 3: Write `src/shared/errors.ts`**

```ts
/** Indonesian text for the `phinas:<code>` errors raised by the Supabase RPCs. */
const MESSAGES: Record<string, string> = {
  invite_invalid: 'Kode undangan tidak ditemukan.',
  invite_used: 'Kode undangan ini sudah dipakai.',
  invite_expired: 'Kode undangan ini sudah kedaluwarsa.',
  invite_revoked: 'Kode undangan ini sudah dicabut.',
  registration_closed: 'Pendaftaran sedang ditutup.',
  terms_required: 'Setujui Syarat & Ketentuan dan Kebijakan Privasi dulu.',
  signup_failed: 'Pendaftaran gagal. Periksa kode undangan lalu coba lagi.',
  quota_exceeded: 'Jatah kode undanganmu sudah habis.',
  friend_code_invalid: 'Kode teman tidak ditemukan.',
  already_friends: 'Kalian sudah berteman.',
  self_friend: 'Itu kode temanmu sendiri.',
  partner_taken: 'Salah satu dari kalian sudah punya pasangan.',
  request_not_found: 'Permintaan ini sudah tidak ada.',
  not_friends: 'Kalian belum berteman.',
  listen_not_allowed: 'Dengar Bareng tidak diizinkan untuk teman ini.',
  account_disabled: 'Akunmu dinonaktifkan. Hubungi admin.',
  not_admin: 'Hanya admin yang bisa melakukan ini.',
  not_signed_in: 'Masuk dulu.',
  name_invalid: 'Nama harus 1 sampai 30 karakter.',
  scope_invalid: 'Pilihan Dengar Bareng tidak dikenal.',
  self_disable: 'Admin tidak bisa menonaktifkan dirinya sendiri.',
  config_unknown: 'Pengaturan tidak dikenal.',
  too_many_requests: 'Terlalu banyak permintaan pertemanan yang belum dijawab.',
  last_admin: 'Kamu admin terakhir. Jadikan orang lain admin dulu sebelum menghapus akun.',
  invalid_args: 'Permintaan tidak valid.',
  config_invalid: 'Nilai pengaturan tidak valid.',
  user_not_found: 'User tidak ditemukan.'
}

const GENERIC = 'Terjadi kesalahan. Coba lagi.'

export function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
  if (!raw) return GENERIC
  const code = /phinas:([a-z_]+)/.exec(raw)?.[1]
  if (code) return MESSAGES[code] ?? GENERIC
  return raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') || GENERIC
}
```

- [ ] **Step 4: Write `src/shared/links.ts`**

The pages are built in sub-project B. Update this one file when the Vercel domain is known.

```ts
/** Public legal pages (built in the web sub-project). */
export const LEGAL_URLS = {
  terms: 'https://muhammad-rapi.github.io/phinas/terms',
  privacy: 'https://muhammad-rapi.github.io/phinas/privacy'
} as const

export type LegalPage = keyof typeof LEGAL_URLS
```

- [ ] **Step 5: Add the shared types**

In `src/shared/types.ts`, replace

```ts
export interface Playlist {
  id: string
  name: string
  updatedAt: number
  /** Cover art of the first (up to) 4 tracks, used for the playlist thumbnail. */
  coverUrls: string[]
}
```

with

```ts
/** Who can see a playlist: only me, my friends, or every Phinas user. */
export type Visibility = 'private' | 'friends' | 'public'

export interface Playlist {
  id: string
  name: string
  updatedAt: number
  /** Cover art of the first (up to) 4 tracks, used for the playlist thumbnail. */
  coverUrls: string[]
  visibility: Visibility
}
```

Replace

```ts
export interface PartnerPlaylist extends PlaylistWithTracks {
  ownerName: string
}
```

with

```ts
/** Someone else's playlist (a friend's, the partner's, or a public one). */
export interface PartnerPlaylist extends PlaylistWithTracks {
  ownerId: string
  ownerName: string
}

/** Who may start Listen Together with me. */
export type ListenScope = 'friends' | 'partner' | 'off'

export interface MyProfile {
  id: string
  displayName: string
  role: 'user' | 'admin'
  disabled: boolean
  /** Short code friends type to add me, e.g. PHN-7K2Q9M. */
  friendCode: string
  listenScope: ListenScope
  /** Codes I can still create; null for admins (no limit). */
  invitesLeft: number | null
}

export interface Friend {
  friendshipId: string
  userId: string
  name: string
  isPartner: boolean
  /** A pending partner request on this friendship, from my point of view. */
  partnerRequest: 'incoming' | 'outgoing' | null
  /** Both scopes and the global switch allow Listen Together. */
  canListen: boolean
}

export interface FriendRequest {
  friendshipId: string
  userId: string
  name: string
  incoming: boolean
}

export interface InviteCode {
  code: string
  createdAt: string
  expiresAt: string
  usedAt: string | null
  usedByName: string | null
  revoked: boolean
}

export interface AppConfig {
  listenTogetherEnabled: boolean
  registrationOpen: boolean
  inviteQuota: number
}

export interface SignUpInput {
  email: string
  password: string
  displayName: string
  inviteCode: string
  acceptedTerms: boolean
}
```

Replace the `ListenInfo` doc comment line

```ts
/** Who we can listen together with. There are only two accounts, so the partner is the other profile. */
```

with

```ts
/** Who we listen together with by default: the partner, when Listen Together is allowed with them. */
```

And replace

```ts
export interface ListenStatus {
  connected: boolean
  partnerHere: boolean
}
```

with

```ts
export interface ListenStatus {
  connected: boolean
  partnerHere: boolean
  /** The server refused the channel (switch off, scope, not friends). No retry until reopened. */
  notAllowed: boolean
}
```

- [ ] **Step 6: Run the test and the type check**

Run: `npx vitest run tests/errors.test.ts`
Expected: PASS (5 tests).

Run: `npm run typecheck`
Expected: errors only about the new `visibility`, `ownerId` and `notAllowed` fields in `src/main/library/library.ts`, `src/main/sync/supabase-remote.ts`, `src/main/sync/realtime.ts`, `src/main/ipc.ts` and `tests/sync-engine.test.ts`. Those are fixed in Tasks 8, 10, 11 and 12. Do not commit yet if anything else fails.

- [ ] **Step 7: Commit**

```bash
git add src/shared tests/errors.test.ts
git commit -m "feat(shared): multi-user types, error messages, legal links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Playlist visibility in the local library

**Files:**
- Modify: `src/main/library/db.ts`
- Modify: `src/main/library/library.ts`
- Test: `tests/library-visibility.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/library-visibility.test.ts`:

```ts
import { DatabaseSync } from 'node:sqlite'
import { beforeEach, expect, test } from 'vitest'
import { migrate, openDb } from '../src/main/library/db'
import { Library } from '../src/main/library/library'

let lib: Library
let clock = 1000
let ids = 0

beforeEach(() => {
  clock = 1000
  ids = 0
  lib = new Library(openDb(':memory:'), () => clock++, () => `pl-${++ids}`)
})

test('new playlists are visible to friends', () => {
  const p = lib.createPlaylist('A')
  expect(p.visibility).toBe('friends')
  expect(lib.listPlaylists()[0].visibility).toBe('friends')
  expect(lib.getPlaylist(p.id)?.visibility).toBe('friends')
})

test('setVisibility stores it, bumps updatedAt and queues a sync', () => {
  const p = lib.createPlaylist('A')
  lib.clearKey(`playlist:${p.id}`)
  lib.setVisibility(p.id, 'public')
  const got = lib.getPlaylist(p.id)!
  expect(got.visibility).toBe('public')
  expect(got.updatedAt).toBeGreaterThan(p.updatedAt)
  expect(lib.pendingKeys()).toEqual([`playlist:${p.id}`])
})

test('setVisibility rejects unknown values', () => {
  const p = lib.createPlaylist('A')
  expect(() => lib.setVisibility(p.id, 'everyone' as never)).toThrow('visibility')
})

test('migrate adds the column to an old database and defaults to friends', () => {
  const db = new DatabaseSync(':memory:')
  db.exec('CREATE TABLE playlists(id TEXT PRIMARY KEY, name TEXT NOT NULL, updated_at INTEGER NOT NULL)')
  db.exec("INSERT INTO playlists VALUES ('old', 'Old', 1)")
  migrate(db)
  migrate(db) // running twice is safe
  const row = db.prepare('SELECT visibility FROM playlists WHERE id = ?').get('old') as { visibility: string }
  expect(row.visibility).toBe('friends')
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/library-visibility.test.ts`
Expected: FAIL, `migrate` is not exported / `setVisibility` is not a function.

- [ ] **Step 3: Add `migrate` to `src/main/library/db.ts`**

Replace

```ts
export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON;')
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;')
  db.exec(SCHEMA)
  return db
}
```

with

```ts
function hasColumn(db: DatabaseSync, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  return cols.some((c) => c.name === column)
}

/** Column changes for databases created by older versions. Safe to run on every start. */
export function migrate(db: DatabaseSync): void {
  if (!hasColumn(db, 'playlists', 'visibility')) {
    db.exec("ALTER TABLE playlists ADD COLUMN visibility TEXT NOT NULL DEFAULT 'friends'")
  }
}

export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON;')
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;')
  db.exec(SCHEMA)
  migrate(db)
  return db
}
```

- [ ] **Step 4: Update `src/main/library/library.ts`**

Change the type import line to:

```ts
import type { FavoriteArtist, LikeEntry, PlayEntry, Playlist, PlaylistWithTracks, PlayRecord, Track, Visibility } from '../../shared/types'
```

Below the `toTrack` function add:

```ts
const VISIBILITIES: readonly Visibility[] = ['private', 'friends', 'public']
```

In `createPlaylist`, replace

```ts
    const p: Playlist = { id: this.newId(), name, updatedAt: this.now(), coverUrls: [] }
```

with

```ts
    const p: Playlist = { id: this.newId(), name, updatedAt: this.now(), coverUrls: [], visibility: 'friends' }
```

After `renamePlaylist` add:

```ts
  setVisibility(id: string, visibility: Visibility): void {
    if (!VISIBILITIES.includes(visibility)) throw new Error(`unknown visibility: ${String(visibility)}`)
    this.tx(() => {
      this.db.prepare('UPDATE playlists SET visibility = ? WHERE id = ?').run(visibility, id)
      this.touch(id)
    })
  }
```

In `listPlaylists`, replace

```ts
    const rows = this.db
      .prepare('SELECT id, name, updated_at FROM playlists ORDER BY updated_at DESC, rowid DESC')
      .all() as { id: string; name: string; updated_at: number }[]
```

with

```ts
    const rows = this.db
      .prepare('SELECT id, name, updated_at, visibility FROM playlists ORDER BY updated_at DESC, rowid DESC')
      .all() as { id: string; name: string; updated_at: number; visibility: Visibility }[]
```

and replace its return mapping

```ts
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      updatedAt: r.updated_at,
      coverUrls: byPlaylist.get(r.id) ?? []
    }))
```

with

```ts
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      updatedAt: r.updated_at,
      coverUrls: byPlaylist.get(r.id) ?? [],
      visibility: r.visibility
    }))
```

In `getPlaylist`, replace

```ts
    const p = this.db.prepare('SELECT id, name, updated_at FROM playlists WHERE id = ?').get(id) as
      | { id: string; name: string; updated_at: number }
      | undefined
```

with

```ts
    const p = this.db.prepare('SELECT id, name, updated_at, visibility FROM playlists WHERE id = ?').get(id) as
      | { id: string; name: string; updated_at: number; visibility: Visibility }
      | undefined
```

and replace

```ts
    return { id: p.id, name: p.name, updatedAt: p.updated_at, coverUrls, tracks }
```

with

```ts
    return { id: p.id, name: p.name, updatedAt: p.updated_at, coverUrls, tracks, visibility: p.visibility }
```

- [ ] **Step 5: Run the library tests**

Run: `npx vitest run tests/library-visibility.test.ts tests/library.test.ts tests/plays-library.test.ts`
Expected: PASS. If `tests/library.test.ts` compares whole playlist objects with `toEqual`, add `visibility: 'friends'` to the expected objects there.

- [ ] **Step 6: Commit**

```bash
git add src/main/library tests/library-visibility.test.ts tests/library.test.ts
git commit -m "feat(library): playlist visibility, synced through the outbox

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Social cache for offline start

**Files:**
- Create: `src/main/sync/cache.ts`
- Test: `tests/social-cache.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/social-cache.test.ts`:

```ts
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, expect, test } from 'vitest'
import { CacheStore, withCache } from '../src/main/sync/cache'
import type { AppConfig } from '../src/shared/types'

const config: AppConfig = { listenTogetherEnabled: true, registrationOpen: true, inviteQuota: 3 }
let path: string

beforeEach(() => {
  path = join(mkdtempSync(join(tmpdir(), 'phinas-cache-')), 'social-cache.json')
})

test('stores values on disk and reads them back in a new instance', () => {
  new CacheStore(path).set('config', config)
  expect(new CacheStore(path).get('config')).toEqual(config)
})

test('a broken file means an empty cache', () => {
  writeFileSync(path, '{not json')
  expect(new CacheStore(path).get('config')).toBeUndefined()
})

test('clear empties memory and disk', () => {
  const c = new CacheStore(path)
  c.set('config', config)
  c.clear()
  expect(c.get('config')).toBeUndefined()
  expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({})
})

test('withCache saves a fresh value', async () => {
  const c = new CacheStore(path)
  const v = await withCache(c, 'config', async () => config)
  expect(v).toEqual(config)
  expect(c.get('config')).toEqual(config)
})

test('withCache falls back to the cache when offline', async () => {
  const c = new CacheStore(path)
  c.set('config', config)
  const v = await withCache(c, 'config', async () => {
    throw new Error('fetch failed')
  })
  expect(v).toEqual(config)
})

test('withCache rethrows when nothing is cached', async () => {
  const c = new CacheStore(path)
  await expect(
    withCache(c, 'config', async () => {
      throw new Error('fetch failed')
    })
  ).rejects.toThrow('fetch failed')
})

test('withCache never hides a server refusal behind the cache', async () => {
  const c = new CacheStore(path)
  c.set('config', config)
  await expect(
    withCache(c, 'config', async () => {
      throw new Error('phinas:account_disabled')
    })
  ).rejects.toThrow('phinas:account_disabled')
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/social-cache.test.ts`
Expected: FAIL, `Cannot find module '../src/main/sync/cache'`.

- [ ] **Step 3: Write `src/main/sync/cache.ts`**

```ts
import { readFileSync, writeFileSync } from 'node:fs'
import type { AppConfig, Friend, MyProfile } from '../../shared/types'

/** The last social data we saw, so the app can start and render offline. */
export interface SocialCache {
  profile?: MyProfile
  friends?: Friend[]
  config?: AppConfig
}

/** Tiny JSON file in the user data folder. A missing or broken file means an empty cache. */
export class CacheStore {
  private data: SocialCache

  constructor(private path: string) {
    try {
      this.data = JSON.parse(readFileSync(path, 'utf8')) as SocialCache
    } catch {
      this.data = {}
    }
  }

  get<K extends keyof SocialCache>(key: K): SocialCache[K] {
    return this.data[key]
  }

  set<K extends keyof SocialCache>(key: K, value: SocialCache[K]): void {
    this.data[key] = value
    this.save()
  }

  /** On sign-out or account deletion. */
  clear(): void {
    this.data = {}
    this.save()
  }

  private save(): void {
    try {
      writeFileSync(this.path, JSON.stringify(this.data))
    } catch (e) {
      console.error('social cache not saved:', e)
    }
  }
}

/**
 * Fetches and caches; on a network failure returns the cached value instead.
 * A `phinas:` error is a real answer from the server (e.g. account disabled), so it is never hidden.
 */
export async function withCache<K extends keyof SocialCache>(
  cache: CacheStore,
  key: K,
  fetch: () => Promise<NonNullable<SocialCache[K]>>
): Promise<NonNullable<SocialCache[K]>> {
  try {
    const v = await fetch()
    cache.set(key, v)
    return v
  } catch (e) {
    const cached = cache.get(key)
    if (cached === undefined || (e instanceof Error && e.message.includes('phinas:'))) throw e
    return cached as NonNullable<SocialCache[K]>
  }
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/social-cache.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/sync/cache.ts tests/social-cache.test.ts
git commit -m "feat(sync): social cache so the app starts offline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: SupabaseRemote: sign-up, RPCs, visibility, friend playlists

**Files:**
- Modify: `src/main/sync/supabase-remote.ts`
- Modify: `tests/sync-engine.test.ts`

This class talks to the network and has no unit tests today; it stays a thin wrapper. The RPC behaviour is covered by the pgTAP tests, and Task 14 checks it end to end against the local stack.

- [ ] **Step 1: Update imports and add the RPC helper**

Replace the import line

```ts
import type { ListenInfo, PartnerPlaylist, PlaylistWithTracks, Track } from '../../shared/types'
```

with

```ts
import type {
  AppConfig,
  Friend,
  FriendRequest,
  InviteCode,
  ListenInfo,
  ListenScope,
  MyProfile,
  PartnerPlaylist,
  PlaylistWithTracks,
  SignUpInput,
  Track,
  Visibility
} from '../../shared/types'
```

Below the `check` function add:

```ts
interface PlaylistRow {
  id: string
  name: string
  updated_at: string
  visibility: Visibility
  owner_id: string
  profiles: { display_name: string } | null
  playlist_tracks: TrackRow[]
}

const PLAYLIST_SELECT =
  'id, name, updated_at, visibility, owner_id, profiles(display_name), playlist_tracks(position, video_id, title, artist, cover_url, duration_sec)'

function toPartnerPlaylist(r: PlaylistRow): PartnerPlaylist {
  const tracks = [...r.playlist_tracks].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map(fromRow)
  return {
    id: r.id,
    name: r.name,
    updatedAt: new Date(r.updated_at).getTime(),
    visibility: r.visibility,
    ownerId: r.owner_id,
    ownerName: r.profiles?.display_name ?? 'Teman',
    coverUrls: tracks
      .slice(0, 4)
      .map((t) => t.coverUrl)
      .filter(Boolean),
    tracks
  }
}
```

- [ ] **Step 2: Add sign-up and the RPC wrappers**

Inside the class, after `signIn`, add:

```ts
  /** Checks the invite first: Supabase Auth hides the trigger's own message behind a generic error. */
  async signUp(input: SignUpInput): Promise<void> {
    if (!input.acceptedTerms) throw new Error('phinas:terms_required')
    const status = await this.rpc<string>('check_invite', { p_code: input.inviteCode })
    if (status !== 'ok') throw new Error(`phinas:${status}`)
    const { error } = await this.sb.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: {
          display_name: input.displayName.trim(),
          invite_code: input.inviteCode.trim().toUpperCase(),
          accepted_terms: true
        }
      }
    })
    if (error) {
      if (/database error/i.test(error.message)) throw new Error('phinas:signup_failed')
      throw new Error(error.message)
    }
  }

  private async rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.sb.rpc(fn, args)
    if (error) throw new Error(error.message)
    return data as T
  }

  myProfile(): Promise<MyProfile> {
    return this.rpc('my_profile')
  }

  async updateMyProfile(displayName: string | null, listenScope: ListenScope | null): Promise<void> {
    await this.rpc('update_my_profile', { p_display_name: displayName, p_listen_scope: listenScope })
  }

  getConfig(): Promise<AppConfig> {
    return this.rpc('get_config')
  }

  listFriends(): Promise<Friend[]> {
    return this.rpc('list_friends')
  }

  listFriendRequests(): Promise<FriendRequest[]> {
    return this.rpc('list_friend_requests')
  }

  async sendFriendRequest(friendCode: string): Promise<void> {
    await this.rpc('send_friend_request', { p_friend_code: friendCode })
  }

  async respondFriendRequest(friendshipId: string, accept: boolean): Promise<void> {
    await this.rpc('respond_friend_request', { p_id: friendshipId, p_accept: accept })
  }

  async removeFriend(friendshipId: string): Promise<void> {
    await this.rpc('remove_friend', { p_id: friendshipId })
  }

  async requestPartner(friendshipId: string): Promise<void> {
    await this.rpc('request_partner', { p_id: friendshipId })
  }

  async respondPartner(friendshipId: string, accept: boolean): Promise<void> {
    await this.rpc('respond_partner', { p_id: friendshipId, p_accept: accept })
  }

  async endPartner(friendshipId: string): Promise<void> {
    await this.rpc('end_partner', { p_id: friendshipId })
  }

  listMyInvites(): Promise<InviteCode[]> {
    return this.rpc('list_my_invites')
  }

  createInvite(): Promise<string> {
    return this.rpc('create_invite')
  }

  async revokeInvite(code: string): Promise<void> {
    await this.rpc('revoke_invite', { p_code: code })
  }

  async deleteAccount(): Promise<void> {
    await this.rpc('delete_my_account')
    await this.sb.auth.signOut({ scope: 'local' })
  }
```

- [ ] **Step 3: Make `me()` public as `userId()`**

Replace

```ts
  private async me(): Promise<string> {
```

with

```ts
  async userId(): Promise<string> {
```

and replace every `await this.me()` in the file with `await this.userId()`.

- [ ] **Step 4: Replace `pairInfo` and `listPartnerPlaylists`**

Replace the whole `pairInfo()` method (doc comment included) with:

```ts
  /** The partner, when Listen Together is allowed with them; otherwise null. */
  async pairInfo(): Promise<ListenInfo | null> {
    const me = await this.userId()
    const partner = (await this.listFriends()).find((f) => f.isPartner && f.canListen)
    return partner ? { me, partnerId: partner.userId, partnerName: partner.name } : null
  }
```

Replace the whole `listPartnerPlaylists()` method with:

```ts
  /** Playlists of one friend, or of every friend. RLS already hides private ones. */
  async listFriendPlaylists(friendId?: string): Promise<PartnerPlaylist[]> {
    const ids = friendId ? [friendId] : (await this.listFriends()).map((f) => f.userId)
    if (ids.length === 0) return []
    const rows = check(
      await this.sb
        .from('playlists')
        .select(PLAYLIST_SELECT)
        .in('owner_id', ids)
        .order('updated_at', { ascending: false })
    ) as unknown as PlaylistRow[]
    return rows.map(toPartnerPlaylist)
  }

  /** Public playlists of every other user. */
  async listPublicPlaylists(): Promise<PartnerPlaylist[]> {
    const me = await this.userId()
    const rows = check(
      await this.sb
        .from('playlists')
        .select(PLAYLIST_SELECT)
        .eq('visibility', 'public')
        .neq('owner_id', me)
        .order('updated_at', { ascending: false })
        .limit(100)
    ) as unknown as PlaylistRow[]
    return rows.map(toPartnerPlaylist)
  }

  /** Bridge for the Berdua tab until the redesign: the partner's playlists. */
  async listPartnerPlaylists(): Promise<PartnerPlaylist[]> {
    const partner = (await this.listFriends()).find((f) => f.isPartner)
    return partner ? this.listFriendPlaylists(partner.userId) : []
  }
```

- [ ] **Step 5: Send visibility on upsert**

In `upsertPlaylist`, replace

```ts
        .upsert({ id: p.id, name: p.name, updated_at: new Date(p.updatedAt).toISOString() })
```

with

```ts
        .upsert({
          id: p.id,
          name: p.name,
          visibility: p.visibility,
          updated_at: new Date(p.updatedAt).toISOString()
        })
```

- [ ] **Step 6: Keep the engine test compiling**

`tests/sync-engine.test.ts` already implements `listPartnerPlaylists` on `FakeRemote`; nothing changes in `Remote`. Run:

Run: `npx vitest run tests/sync-engine.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/main/sync/supabase-remote.ts
git commit -m "feat(sync): sign-up, friend and invite RPCs, playlist visibility

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Private pair channel and PresenceHub

**Files:**
- Modify: `src/main/sync/realtime.ts`
- Create: `src/main/sync/presence.ts`
- Test: `tests/presence.test.ts`

- [ ] **Step 1: Write the failing PresenceHub test**

`tests/presence.test.ts`:

```ts
import { beforeEach, expect, test } from 'vitest'
import { PresenceHub, type RealtimeLike } from '../src/main/sync/presence'

class FakeChannel {
  presence: Record<string, unknown[]> = {}
  tracked = false
  private onSync: (() => void) | null = null
  constructor(
    public name: string,
    public opts: unknown
  ) {}
  on(_type: string, _filter: unknown, cb: () => void): this {
    this.onSync = cb
    return this
  }
  subscribe(cb: (status: string) => void): this {
    cb('SUBSCRIBED')
    return this
  }
  async track(): Promise<void> {
    this.tracked = true
  }
  presenceState(): Record<string, unknown[]> {
    return this.presence
  }
  fireSync(): void {
    this.onSync?.()
  }
}

class FakeClient implements RealtimeLike {
  channels: FakeChannel[] = []
  removed: string[] = []
  authed = 0
  realtime = { setAuth: async (): Promise<void> => void this.authed++ }
  channel(name: string, opts: unknown): FakeChannel {
    const ch = new FakeChannel(name, opts)
    this.channels.push(ch)
    return ch
  }
  async removeChannel(ch: FakeChannel): Promise<void> {
    this.removed.push(ch.name)
  }
}

let client: FakeClient
let events: string[][]
let hub: PresenceHub

beforeEach(() => {
  client = new FakeClient()
  events = []
  hub = new PresenceHub(client, (_ch, v) => events.push(v as string[]))
})

test('joins my channel and tracks myself, joins friends channels without tracking', async () => {
  await hub.sync('me', ['f1', 'f2'])
  expect(client.channels.map((c) => c.name)).toEqual(['presence:me', 'presence:f1', 'presence:f2'])
  expect(client.channels.map((c) => (c.opts as { config: { private: boolean } }).config.private)).toEqual([
    true,
    true,
    true
  ])
  expect(client.channels[0].tracked).toBe(true)
  expect(client.channels[1].tracked).toBe(false)
  expect(client.authed).toBe(1)
})

test('reports a friend online when their key appears, and offline when it goes', async () => {
  await hub.sync('me', ['f1'])
  const f1 = client.channels[1]
  f1.presence = { f1: [{}] }
  f1.fireSync()
  expect(hub.onlineIds()).toEqual(['f1'])
  expect(events.at(-1)).toEqual(['f1'])
  f1.presence = {}
  f1.fireSync()
  expect(hub.onlineIds()).toEqual([])
  expect(events.at(-1)).toEqual([])
})

test('leaves channels of people who are no longer friends', async () => {
  await hub.sync('me', ['f1', 'f2'])
  client.channels[2].presence = { f2: [{}] }
  client.channels[2].fireSync()
  await hub.sync('me', ['f1'])
  expect(client.removed).toEqual(['presence:f2'])
  expect(hub.onlineIds()).toEqual([])
})

test('a second sync with the same friends joins nothing new', async () => {
  await hub.sync('me', ['f1'])
  await hub.sync('me', ['f1'])
  expect(client.channels).toHaveLength(2)
})

test('close leaves everything', async () => {
  await hub.sync('me', ['f1'])
  await hub.close()
  expect(client.removed.sort()).toEqual(['presence:f1', 'presence:me'])
  expect(hub.onlineIds()).toEqual([])
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/presence.test.ts`
Expected: FAIL, `Cannot find module '../src/main/sync/presence'`.

- [ ] **Step 3: Write `src/main/sync/presence.ts`**

```ts
type Emit = (channel: string, value: unknown) => void

interface ChannelLike {
  on(type: 'presence', filter: { event: 'sync' }, cb: () => void): ChannelLike
  subscribe(cb: (status: string) => void): ChannelLike
  track(payload: Record<string, unknown>): Promise<unknown>
  presenceState(): Record<string, unknown[]>
}

/** The part of SupabaseClient this hub uses (so tests can fake it). */
export interface RealtimeLike {
  realtime: { setAuth(token?: string | null): Promise<void> }
  channel(name: string, opts: { config: { private: boolean; presence: { key: string } } }): ChannelLike
  removeChannel(ch: never): Promise<unknown>
}

/**
 * Who of my friends has Phinas open. I track presence on `presence:<me>`;
 * friends' channels are only watched. Access is checked by the server (can_join_topic).
 */
export class PresenceHub {
  private channels = new Map<string, ChannelLike>()
  private online = new Set<string>()
  private me: string | null = null

  constructor(
    private readonly sb: RealtimeLike,
    private readonly emit: Emit
  ) {}

  onlineIds(): string[] {
    return [...this.online].sort()
  }

  async sync(me: string, friendIds: string[]): Promise<void> {
    if (this.me !== me) await this.close()
    this.me = me
    const want = new Set([me, ...friendIds])
    for (const [id, ch] of this.channels) {
      if (want.has(id)) continue
      this.channels.delete(id)
      await this.sb.removeChannel(ch as never)
      this.setOnline(id, false)
    }
    const missing = [...want].filter((id) => !this.channels.has(id))
    if (missing.length === 0) return
    await this.sb.realtime.setAuth()
    for (const id of missing) {
      const ch = this.sb.channel(`presence:${id}`, { config: { private: true, presence: { key: me } } })
      if (id !== me) ch.on('presence', { event: 'sync' }, () => this.setOnline(id, id in ch.presenceState()))
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED' && id === me) void ch.track({ at: Date.now() })
      })
      this.channels.set(id, ch)
    }
  }

  async close(): Promise<void> {
    const all = [...this.channels.values()]
    this.channels.clear()
    this.me = null
    for (const ch of all) await this.sb.removeChannel(ch as never)
    if (this.online.size > 0) {
      this.online.clear()
      this.emit('friends:online', [])
    }
  }

  private setOnline(id: string, v: boolean): void {
    if (this.online.has(id) === v) return
    if (v) this.online.add(id)
    else this.online.delete(id)
    this.emit('friends:online', this.onlineIds())
  }
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/presence.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Make the pair channel private in `src/main/sync/realtime.ts`**

Replace the class doc comment

```ts
/**
 * One Realtime channel shared by the two accounts. Only state is sent (see the spec),
 * never audio. The channel name comes from the two user ids, so no table is needed.
 */
```

with

```ts
/**
 * One private Realtime channel per pair of friends. Only state is sent, never audio.
 * The name comes from the two sorted user ids; the server checks can_join_topic().
 */
```

Add a field below `private partnerHere = false`:

```ts
  private notAllowed = false
```

Replace `status()`:

```ts
  status(): ListenStatus {
    return { connected: this.connected, partnerHere: this.partnerHere, notAllowed: this.notAllowed }
  }
```

Replace the beginning of `open()` up to and including the `ch.subscribe(...)` call:

```ts
  async open(me: string, partnerId: string): Promise<void> {
    const name = `pair:${[me, partnerId].sort().join(':')}`
    if (this.channel && this.name === name) return
    await this.close()
    this.notAllowed = false
    await this.sb.realtime.setAuth()
    const ch = this.sb.channel(name, {
      config: { private: true, broadcast: { self: false }, presence: { key: me } }
    })
    ch.on('broadcast', { event: 'msg' }, ({ payload }) => this.emit('listen:message', payload))
    ch.on('presence', { event: 'sync' }, () => this.setHere(partnerId in ch.presenceState()))
    ch.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        void ch.track({ at: Date.now() })
        this.setConnected(true)
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.setConnected(false)
        this.setHere(false) // cannot know while we are offline; the next presence sync fixes it
        // A refusal from the authorization policy will not change by retrying.
        if (status === 'CHANNEL_ERROR' && err && /unauthori[sz]ed|not allowed|permission/i.test(err.message)) {
          this.notAllowed = true
          void this.close()
        }
      }
    })
```

(Keep the remaining lines of `open()` — `this.channel = ch` and `this.name = name` — as they are.)

`close()` resets `connected` and `partnerHere` but must keep `notAllowed` so the renderer can read it; leave `close()` unchanged.

- [ ] **Step 6: Type check this file**

Run: `npm run typecheck`
Expected: no errors in `realtime.ts`, `presence.ts` or `cache.ts`. Remaining errors only in `src/main/ipc.ts` (fixed next task).

- [ ] **Step 7: Commit**

```bash
git add src/main/sync/presence.ts src/main/sync/realtime.ts tests/presence.test.ts
git commit -m "feat(sync): private pair channel and friends presence

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: IPC, preload and main wiring

**Files:**
- Modify: `src/shared/ipc.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Extend the API contract in `src/shared/ipc.ts`**

Replace the first import line with:

```ts
import type { AppConfig, ArtistDetail, FavoriteArtist, Friend, FriendRequest, GenrePage, InviteCode, UpdateStatus, ListenInfo, ListenScope, ListenStatus, MyProfile, NotchState, PlayRecord, PlayerCommand, Recommendations, HomeFeed, ImportResult, Lyrics, PublicPlaylist, PublicPlaylistDetail, PartnerPlaylist, Playlist, PlaylistWithTracks, SignUpInput, SyncStatus, Track, Visibility } from './types'
import type { LegalPage } from './links'
```

In `PhinasApi`, after `syncStatus(): Promise<SyncStatus>` add:

```ts
  /** Registers with an invite code; signs in on success. Errors carry `phinas:<code>`. */
  syncSignUp(input: SignUpInput): Promise<void>
  /** Null when not signed in or Supabase is not configured. Falls back to the cache offline. */
  myProfile(): Promise<MyProfile | null>
  /** Null leaves a field unchanged. */
  updateMyProfile(displayName: string | null, listenScope: ListenScope | null): Promise<void>
  /** Null when not signed in. Falls back to the cache offline. */
  getConfig(): Promise<AppConfig | null>
  /** Accepted friends, partner first. Falls back to the cache offline. */
  listFriends(): Promise<Friend[]>
  listFriendRequests(): Promise<FriendRequest[]>
  sendFriendRequest(friendCode: string): Promise<void>
  respondFriendRequest(friendshipId: string, accept: boolean): Promise<void>
  removeFriend(friendshipId: string): Promise<void>
  requestPartner(friendshipId: string): Promise<void>
  respondPartner(friendshipId: string, accept: boolean): Promise<void>
  endPartner(friendshipId: string): Promise<void>
  listMyInvites(): Promise<InviteCode[]>
  createInvite(): Promise<string>
  revokeInvite(code: string): Promise<void>
  /** Deletes the account and everything in it on the server, then signs out. Local data stays. */
  deleteAccount(): Promise<void>
  /** Ids of friends who have Phinas open right now. */
  onlineFriends(): Promise<string[]>
  setPlaylistVisibility(id: string, visibility: Visibility): Promise<void>
  /** Playlists of one friend, or of every friend. */
  listFriendPlaylists(friendId?: string): Promise<PartnerPlaylist[]>
  /** Public playlists of every other user. */
  listPublicPlaylists(): Promise<PartnerPlaylist[]>
  /** Opens the terms or privacy page in the browser. */
  openLegal(page: LegalPage): Promise<void>
```

Change the doc comment of `listPartnerPlaylists` (add one above it if missing) to:

```ts
  /** The partner's playlists (Berdua tab). Renamed in the redesign. */
```

In `PhinasEvents`, after `onListenConnection` add:

```ts
  /** The set of online friends changed. Returns an unsubscribe. */
  onFriendsOnline(cb: (ids: string[]) => void): () => void
```

In `CHANNEL_MAP`, after `syncStatus: true,` add:

```ts
  syncSignUp: true,
  myProfile: true,
  updateMyProfile: true,
  getConfig: true,
  listFriends: true,
  listFriendRequests: true,
  sendFriendRequest: true,
  respondFriendRequest: true,
  removeFriend: true,
  requestPartner: true,
  respondPartner: true,
  endPartner: true,
  listMyInvites: true,
  createInvite: true,
  revokeInvite: true,
  deleteAccount: true,
  onlineFriends: true,
  setPlaylistVisibility: true,
  listFriendPlaylists: true,
  listPublicPlaylists: true,
  openLegal: true,
```

- [ ] **Step 2: Add the preload event**

In `src/preload/index.ts`, after the `onListenConnection` line add:

```ts
  onFriendsOnline: (cb) => subscribe('friends:online', cb),
```

- [ ] **Step 3: Add the handlers in `src/main/ipc.ts`**

Add imports at the top:

```ts
import { LEGAL_URLS } from '../shared/links'
import { withCache, type CacheStore } from './sync/cache'
import type { PresenceHub } from './sync/presence'
```

In `Deps`, after `pair: PairChannel | null` add:

```ts
  /** Friends' online state; null when Supabase is not configured. */
  presence: PresenceHub | null
  cache: CacheStore
  openExternal: (url: string) => void
```

Inside `createHandlers`, after `requireRemote` add:

```ts
  const signedIn = async (): Promise<SupabaseRemote | null> =>
    d.remote && (await d.remote.session()) ? d.remote : null

  /** Leaves every realtime channel and forgets cached social data. */
  const leaveAll = async (): Promise<void> => {
    await d.pair?.close()
    await d.presence?.close()
    d.cache.clear()
  }
```

Replace the existing `syncSignOut` handler with:

```ts
    syncSignOut: async () => {
      await leaveAll()
      await requireRemote().signOut()
    },
```

After `syncStatus` add:

```ts
    syncSignUp: async (input) => {
      await requireRemote().signUp(input)
      d.lastError.value = undefined
      void d.engine?.flush()
    },
    myProfile: async () => {
      const r = await signedIn()
      return r ? withCache(d.cache, 'profile', () => r.myProfile()) : null
    },
    updateMyProfile: async (name, scope) => {
      await requireRemote().updateMyProfile(name, scope)
      d.cache.set('profile', await requireRemote().myProfile())
    },
    getConfig: async () => {
      const r = await signedIn()
      return r ? withCache(d.cache, 'config', () => r.getConfig()) : null
    },
    listFriends: async () => {
      const r = requireRemote()
      const friends = await withCache(d.cache, 'friends', () => r.listFriends())
      void r
        .userId()
        .then((me) => d.presence?.sync(me, friends.map((f) => f.userId)))
        .catch((e) => console.warn('[presence] sync failed:', e))
      return friends
    },
    listFriendRequests: () => requireRemote().listFriendRequests(),
    sendFriendRequest: (code) => requireRemote().sendFriendRequest(code),
    respondFriendRequest: (id, accept) => requireRemote().respondFriendRequest(id, accept),
    removeFriend: (id) => requireRemote().removeFriend(id),
    requestPartner: (id) => requireRemote().requestPartner(id),
    respondPartner: (id, accept) => requireRemote().respondPartner(id, accept),
    endPartner: (id) => requireRemote().endPartner(id),
    listMyInvites: () => requireRemote().listMyInvites(),
    createInvite: () => requireRemote().createInvite(),
    revokeInvite: (code) => requireRemote().revokeInvite(code),
    deleteAccount: async () => {
      await leaveAll()
      await requireRemote().deleteAccount()
    },
    onlineFriends: async () => d.presence?.onlineIds() ?? [],
    setPlaylistVisibility: async (id, v) => d.library.setVisibility(id, v),
    listFriendPlaylists: (friendId) => requireRemote().listFriendPlaylists(friendId),
    listPublicPlaylists: () => requireRemote().listPublicPlaylists(),
    openLegal: async (page) => {
      const url = LEGAL_URLS[page]
      if (url) d.openExternal(url)
    },
```

Replace the `listenStatus` handler with:

```ts
    listenStatus: async () => d.pair?.status() ?? { connected: false, partnerHere: false, notAllowed: false },
```

- [ ] **Step 4: Wire it in `src/main/index.ts`**

Add imports next to the other sync imports:

```ts
import { CacheStore } from './sync/cache'
import { PresenceHub } from './sync/presence'
```

After the `const pair = remote ? new PairChannel(...) : null` statement add:

```ts
  const presence = remote
    ? new PresenceHub(remote.client, (channel, value) => mainWindow?.webContents.send(channel, value))
    : null
  const cache = new CacheStore(join(userData, 'social-cache.json'))
```

In the `createHandlers({ ... })` call, after `pair,` add:

```ts
    presence,
    cache,
    openExternal: (url) => void shell.openExternal(url),
```

Move the sync interval below `createHandlers` so it can refresh friends (and with them presence). Delete this block:

```ts
  if (engine && remote) {
    setInterval(async () => {
      if (!(await remote.session())) return
      const r = await engine.flush()
      lastError.value = r.error
    }, SYNC_INTERVAL_MS)
  }
```

and insert directly after the `for (const name of CHANNELS) { ... }` loop:

```ts
  if (engine && remote) {
    let tick = 0
    setInterval(async () => {
      if (!(await remote.session())) return
      const r = await engine.flush()
      lastError.value = r.error
      // Every minute: refresh friends (keeps presence in step) and leave a pair that is no longer allowed.
      if (tick++ % 4 === 0) {
        const friends = await handlers.listFriends().catch(() => null)
        if (friends && !friends.some((f) => f.isPartner && f.canListen)) await pair?.close()
      }
    }, SYNC_INTERVAL_MS)
  }
```

`remote.client` is a full `SupabaseClient`; if TypeScript rejects it as `RealtimeLike`, pass `remote.client as unknown as RealtimeLike` and import the type from `./sync/presence`.

- [ ] **Step 5: Type check and run all unit tests**

Run: `npm run typecheck`
Expected: no errors except in renderer files that read `ListenStatus` (none today) — if any remain in `src/renderer`, they are fixed in Task 13.

Run: `npm test`
Expected: all Vitest files pass.

- [ ] **Step 6: Commit**

```bash
git add src/shared/ipc.ts src/main/ipc.ts src/preload/index.ts src/main/index.ts
git commit -m "feat(ipc): friends, invites, profile, visibility and presence over IPC

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Bridge UI in Profil (sign-up, friend code, disabled, delete account)

**Files:**
- Modify: `src/renderer/src/screens/Profile.tsx`

The full friends UI comes with the redesign (sub-project C). This task only keeps the app usable: register with a code, see your friend code, know when the account is disabled, and delete the account.

- [ ] **Step 1: Imports and state**

Replace the first two import lines with:

```tsx
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { friendlyError } from '../../../shared/errors'
import type { MyProfile, SyncStatus } from '../../../shared/types'
```

Replace

```tsx
  const [error, setError] = useState<string | null>(null)
  const [notch, setNotch] = useNotchEnabled()

  const load = useCallback(() => window.phinas.syncStatus().then(setStatus), [])
```

with

```tsx
  const [error, setError] = useState<string | null>(null)
  const [notch, setNotch] = useNotchEnabled()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [profile, setProfile] = useState<MyProfile | null>(null)

  const load = useCallback(async () => {
    const s = await window.phinas.syncStatus()
    setStatus(s)
    setProfile(s.signedIn ? await window.phinas.myProfile().catch(() => null) : null)
  }, [])
```

- [ ] **Step 2: Sign-in and sign-up handlers**

Replace the whole `signIn` function with:

```tsx
  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    try {
      if (mode === 'up') {
        await window.phinas.syncSignUp({ email, password, displayName, inviteCode, acceptedTerms: accepted })
      } else {
        await window.phinas.syncSignIn(email, password)
      }
      setPassword('')
      setInviteCode('')
      await load()
      await lib.refreshPartner()
    } catch (err) {
      setError(friendlyError(err) || (mode === 'up' ? 'Pendaftaran gagal' : 'Login gagal'))
    }
  }

  const deleteAccount = async (): Promise<void> => {
    const ok = window.confirm(
      'Hapus akun Phinas? Playlist dan lagu yang disukai di server ikut terhapus, dan teman-temanmu tidak bisa melihatnya lagi. Data di komputer ini tetap ada.'
    )
    if (!ok) return
    try {
      await window.phinas.deleteAccount()
      await load()
      await lib.refreshPartner()
    } catch (err) {
      setError(friendlyError(err))
    }
  }
```

- [ ] **Step 3: Account section markup**

Replace the whole `<section className="profile-section">` that starts with `<h3>Akun dan sync dengan pasangan</h3>` with:

```tsx
      <section className="profile-section">
        <h3>Akun</h3>
        {status && !status.configured && (
          <div className="notice">Supabase belum dikonfigurasi. Isi file .env lalu jalankan ulang app.</div>
        )}
        {status?.configured && status.signedIn && (
          <>
            {profile?.disabled && <div className="notice">{friendlyError(new Error('phinas:account_disabled'))}</div>}
            <p>
              Masuk sebagai <strong>{status.email}</strong>.{' '}
              {status.pending === 0 ? 'Semua perubahan sudah tersinkron.' : `${status.pending} perubahan belum tersinkron.`}
            </p>
            {profile && (
              <p>
                Kode temanmu: <strong style={{ userSelect: 'text' }}>{profile.friendCode}</strong>
              </p>
            )}
            {status.lastError && <div className="notice">Sync gagal: {status.lastError}. Akan dicoba lagi otomatis.</div>}
            {error && <div className="notice">{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn secondary"
                onClick={async () => {
                  await window.phinas.syncSignOut()
                  await load()
                  await lib.refreshPartner()
                }}
              >
                Keluar
              </button>
              <button className="btn secondary" onClick={() => void deleteAccount()}>
                Hapus akun
              </button>
            </div>
          </>
        )}
        {status?.configured && !status.signedIn && (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 }}>
            {mode === 'up' && (
              <input
                placeholder="Nama"
                value={displayName}
                maxLength={30}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            )}
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input
              type="password"
              placeholder="Password"
              value={password}
              minLength={mode === 'up' ? 6 : undefined}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {mode === 'up' && (
              <>
                <input
                  placeholder="Kode undangan"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  required
                />
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} required />
                  <span>
                    Saya setuju dengan{' '}
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        void window.phinas.openLegal('terms')
                      }}
                    >
                      Syarat &amp; Ketentuan
                    </a>{' '}
                    dan{' '}
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        void window.phinas.openLegal('privacy')
                      }}
                    >
                      Kebijakan Privasi
                    </a>
                    .
                  </span>
                </label>
              </>
            )}
            {error && <div className="notice">{error}</div>}
            <button className="btn" type="submit">
              {mode === 'up' ? 'Daftar' : 'Masuk'}
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setMode(mode === 'up' ? 'in' : 'up')
                setError(null)
              }}
            >
              {mode === 'up' ? 'Sudah punya akun? Masuk' : 'Punya kode undangan? Daftar'}
            </button>
          </form>
        )}
      </section>
```

- [ ] **Step 4: Type check and tests**

Run: `npm run typecheck && npm test`
Expected: no type errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/screens/Profile.tsx
git commit -m "feat(profile): register with an invite code, friend code, delete account

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: End-to-end check against the local stack

No code. Verifies the app and the database together before anything touches production.

- [ ] **Step 1: Point a dev build at the local stack**

Run: `supabase status -o env | grep -E '^(API_URL|ANON_KEY)='`
Expected: `API_URL="http://127.0.0.1:54321"` and an `ANON_KEY`.

Back up the real env file and write a local one:

```bash
cp .env .env.production.bak
printf 'MAIN_VITE_SUPABASE_URL=%s\nMAIN_VITE_SUPABASE_ANON_KEY=%s\n' \
  "$(supabase status -o env | sed -n 's/^API_URL="\(.*\)"/\1/p')" \
  "$(supabase status -o env | sed -n 's/^ANON_KEY="\(.*\)"/\1/p')" > .env
```

Local Auth has email confirmation off by default (`[auth.email] enable_confirmations = false` in `supabase/config.toml`); confirm that line.

- [ ] **Step 2: Walk the flows**

Run: `npm run dev`

1. Profil → "Punya kode undangan? Daftar". Register `admin@local.test` with any code (e.g. `ANYTHING`). The first account bootstraps as admin, so it succeeds and the friend code shows.
2. Create an invite for the next account. In a terminal:
   ```bash
   DB_URL="$(supabase status -o env | sed -n 's/^DB_URL="\(.*\)"/\1/p')"
   psql "$DB_URL" -c "insert into invite_codes (code, created_by) select 'TESTCODE', id from profiles limit 1"
   ```
   (`psql` comes with `brew install libpq` if missing; or run the same SQL with `docker exec -i supabase_db_phinas-desktop psql -U postgres -c "..."`.)
3. Sign out, register a second account with `TESTCODE`. Expect success. Register a third with `TESTCODE`: expect "Kode undangan ini sudah dipakai."
4. With a wrong code: expect "Kode undangan tidak ditemukan."
5. Create a playlist, wait 15 s, then `psql "$DB_URL" -c "select name, visibility from playlists"` shows it with `friends`.
6. "Hapus akun" on the second account and confirm; `psql "$DB_URL" -c "select count(*) from profiles"` drops by one.

Record what happened for each step. If any step misbehaves, stop and use superpowers:systematic-debugging.

- [ ] **Step 3: Restore the production env**

```bash
mv .env.production.bak .env
```

Run: `git status --short` and confirm `.env` is not listed (it is git-ignored) and nothing else changed.

---

### Task 15: Production rollout (with the user, not automated)

Every step here changes the live project. Do each only after the user says go, and show them the output.

- [ ] **Step 1: Link the CLI** — the user runs `! supabase login`, then `supabase link --project-ref <ref>` (the ref is in the Supabase URL in `.env`; the DB password comes from the user).
- [ ] **Step 2: Mark the hand-applied schema as applied** — `supabase migration repair --status applied 20261120000000`.
- [ ] **Step 3: Dry run** — `supabase db push --dry-run`; expect exactly migrations `...0100` to `...0600`.
- [ ] **Step 4: Push** — `supabase db push`.
- [ ] **Step 4b: Check the Realtime policies exist** — in the SQL editor: `select count(*) from pg_policies where schemaname = 'realtime' and policyname like 'phinas%';` must be `2`. If it is `0`, the migration skipped them (no `realtime.messages`); stop and investigate before shipping the app.
- [ ] **Step 5: Make the user admin** — in the SQL editor: `update public.profiles set role = 'admin' where id = (select id from auth.users where email = '<user email>');` then `select display_name, role, friend_code from public.profiles;` and confirm the two existing accounts are partners: `select is_partner from public.friendships;` → `true`.
- [ ] **Step 6: Auth settings** — Authentication → Providers → Email: turn off "Confirm email". Keep sign-ups enabled.
- [ ] **Step 7: Ship the app** — release a new desktop version with the existing release flow (see memory `project-phinas-desktop-release-flow`) and update both existing installs. The old 0.4.0 app still opens the public `phinas:pair:` channel and assumes one other profile, so both people should update right away.
- [ ] **Step 8: Close public Realtime** — after both apps are updated: Realtime → Settings → turn off "Allow public access", so only authorized private channels work.
- [ ] **Step 9: Smoke test in production** — both apps sign in, Berdua shows the partner's playlists, Listen Together connects.
