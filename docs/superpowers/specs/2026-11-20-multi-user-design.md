# Multi-user Phinas (sub-project A): design

Date: 2026-11-20
Status: draft for review

## Goal
Open Phinas to the user's friends. Today the backend assumes exactly two accounts: every signed-in user can read every playlist and like, and "partner" means "the other profile". This sub-project replaces that with invite-only registration, a friend graph with an optional mutual partner, per-playlist visibility, server-enforced Listen Together permissions, and the tables an admin panel needs.

## Roadmap (three sub-projects)
1. **A. Multi-user backend + desktop data layer** (this spec). No new UI beyond a minimal bridge.
2. **C. App redesign.** A deeper move away from the Spotify look than the 2026-11-17 less-spotify pass, a quieter Home, offline-first behaviour (see below), and the new screens: registration, friends, partner, invites, playlist visibility, Listen Together settings.
3. **B. Web on Vercel.** One Next.js project: download page (latest release from GitHub Releases), `/terms`, `/privacy`, `/admin` MVP (user list, invite codes, global switches, disable user). Depends only on A's schema; can run in parallel with C.

The app is ready to share with friends after A and C.

Offline-first for C means option 2: the app opens fast and stays fully usable offline for local data (library, playlists, likes, history, cached Home). Changes queue and sync on reconnect. Playback and search say clearly that they need internet. No offline audio downloads.

## Decisions
- **Relationships:** friends, many per user. Each user may have **at most one partner**, a flag on an accepted friendship, set only with consent from both sides. The partner is pinned first, owns the Berdua tab, and is the default Listen Together target.
- **Becoming friends:** registering with someone's invite code makes you friends with its creator. Existing users befriend each other by entering a short friend code (e.g. `PHN-7K2Q`) shown in the profile; the other side accepts. No user search.
- **Invite codes:** admins unlimited; users get a quota (`invite_quota`, default 3, admin-editable, 0 closes it). Codes are single-use and expire after 14 days. The admin panel shows who invited whom.
- **Playlist visibility:** `private` (owner only), `friends` (default), `public` (every active Phinas user; never shown on the website). Likes are visible to friends, with no separate setting.
- **Listen Together:** a global switch (`listen_together_enabled`) and a per-user `listen_scope`: `friends` (default), `partner`, `off`. Both participants' scopes must allow the session. Enforced by the server.
- **Email confirmation:** off for MVP. The invite code is the gate, and Supabase's built-in SMTP is limited to about 2 emails per hour.
- **Approach:** everything in Postgres. RLS for access, a trigger on `auth.users` for registration, `security definer` RPCs for actions. No Edge Functions, no dependency on Vercel. The same rules serve desktop, admin web and future mobile.

## Data model

```
profiles        id, display_name, role ('user'|'admin') default 'user',
                disabled bool default false, friend_code text unique,
                accepted_terms_at timestamptz, invited_by uuid null,
                listen_scope ('friends'|'partner'|'off') default 'friends',
                created_at
friendships     id, user_a, user_b (user_a < user_b, unique pair),
                status ('pending'|'accepted'), requested_by,
                is_partner bool default false, partner_requested_by uuid null,
                created_at
invite_codes    code primary key, created_by, created_at,
                expires_at (created_at + 14 days), used_by null, used_at null,
                revoked bool default false
app_config      key text primary key, value jsonb
                seeds: listen_together_enabled=true, registration_open=true,
                       invite_quota=3
playlists       + visibility ('private'|'friends'|'public') default 'friends'
```

One partner per user: a user may appear in at most one `friendships` row with `is_partner = true`. A user can sit in either column, so a single unique index cannot express this. It is enforced by a `before insert or update` trigger on `friendships` that locks both users' profile rows and rejects with `partner_taken`.

## Registration
The app calls `auth.signUp` with `data: { display_name, invite_code, accepted_terms: true }`. The `handle_new_user` trigger on `auth.users`:
1. Rejects with `registration_closed` when `registration_open` is false.
2. Rejects unless `accepted_terms` is true (`terms_required`).
3. Locks the invite row and rejects with `invite_invalid`, `invite_used`, `invite_expired` or `invite_revoked`.
4. Creates the profile (unique `friend_code`, `accepted_terms_at = now()`, `invited_by`), marks the code used, and inserts an accepted friendship with the code's creator.

Any rejection raises an exception, so the auth user is not created. Error codes are carried in the exception message as `phinas:<code>` and mapped to Indonesian text in the app.

## Access rules
Helpers (SQL, `stable`, `security definer` where needed): `is_active(uid)`, `is_admin()`, `are_friends(a, b)`, `is_partner(a, b)`, `config(key)`.

Every policy also requires the caller to be active. A disabled account can read and write nothing; the app shows "Akun dinonaktifkan".

| Table | Read | Write |
|---|---|---|
| `profiles` | self, friends, owners of public playlists (display name only, through a view) | self: `display_name`, `listen_scope`; never `role`/`disabled` |
| `playlists`, `playlist_tracks` | own; `friends` → friends; `public` → all active users | own |
| `liked_tracks` | self, friends | own |
| `friendships` | rows that include the caller | RPC only |
| `invite_codes` | codes the caller created | RPC only |
| `app_config` | all active users | admin RPC only |

Column protection on `profiles` uses a `before update` trigger that rejects changes to `role`, `disabled`, `friend_code`, `invited_by`, `accepted_terms_at` unless the caller is an admin RPC.

### RPCs
User: `create_invite()` (quota is a lifetime limit: used codes plus still-open codes count; expired or revoked unused codes do not), `revoke_invite(code)`, `send_friend_request(friend_code)`, `respond_friend_request(id, accept)`, `remove_friend(id)`, `request_partner(friendship_id)`, `respond_partner(friendship_id, accept)`, `end_partner(friendship_id)`, `delete_my_account()`.

Admin (all check `is_admin()`): `admin_list_users()` (joins `auth.users` for email, created and last sign-in times, invited_by, disabled, role), `admin_set_disabled(uid, bool)`, `admin_set_config(key, value)`, `admin_create_invite()`, `admin_list_invites()`.

Error codes: `invite_invalid`, `invite_used`, `invite_expired`, `invite_revoked`, `registration_closed`, `terms_required`, `quota_exceeded`, `friend_code_invalid`, `already_friends`, `self_friend`, `partner_taken`, `not_friends`, `listen_not_allowed`, `account_disabled`, `not_admin`.

## Listen Together channels
- Session channel: `pair:<uuidA>:<uuidB>` (sorted ids), `private: true`.
- Presence channel: `presence:<uid>`, `private: true`, one per user; friends join it to see who is online.
- RLS on `realtime.messages` (Supabase Realtime Authorization) checks `realtime.topic()`:
  - `pair:*`: global switch on, caller is one of the two ids, both active, friends, and both `listen_scope` values allow it (`friends` → any friend, `partner` → partner only, `off` → nobody).
  - `presence:*`: caller is the owner or an active friend of the owner.
- Join is checked when a channel subscribes. If the switch or a scope changes during a session, the open channel may keep working, so the app re-reads `app_config` and the friend's `canListen` before each session starts and ends a session that is no longer allowed. New joins are always blocked by the server.

## Desktop changes (data layer only)

**Remote and IPC**
- `signUp({ email, password, displayName, inviteCode, acceptedTerms })`
- Friends: `listFriends()` → `{ id, name, isPartner, online, canListen }[]`, `listFriendRequests()`, `sendFriendRequest(code)`, `respondFriendRequest(id, accept)`, `removeFriend(id)`, `requestPartner(id)`, `respondPartner(id, accept)`, `endPartner(id)`.
- Invites: `listMyInvites()`, `createInvite()`, `revokeInvite(code)`.
- `getConfig()`, `setListenScope(scope)`, `deleteAccount()`, `myProfile()` (includes `friendCode`).
- `pairInfo()` is removed. `listPartnerPlaylists()` becomes `listFriendPlaylists(friendId?)` and `listPublicPlaylists()`, both returning `ownerId`, `ownerName`, `visibility`.

**Local library**
- Migration adds `visibility` to local playlists (default `friends`); upsert sends it.
- Cache `app_config`, friends and own profile locally so the app starts and renders offline.

**Realtime**
- `PairChannel.open(me, friendId)` uses a private channel. A join refused by the server sets status `not-allowed` and does not retry.
- New `PresenceHub` tracks friends' online state over their presence channels.

**Errors**
`phinas:<code>` messages map to Indonesian strings in one table in `src/shared`. Unknown errors fall back to a generic message plus the raw text in the log.

**Bridge UI until C**
Minimal so the app keeps working: Profile gets a sign-up form (invite code, T&C checkbox with links to the site), Berdua shows the partner, Listen Together targets the partner. Friend management, visibility controls and every other new screen belong to C.

## Migration
- Move `supabase/schema.sql` into `supabase/migrations/` (initial migration = current schema), then add this change as a new migration.
- Existing two accounts: create an accepted friendship with `is_partner = true`, give both a `friend_code` and `accepted_terms_at = now()`, set the user's own account to `role = 'admin'` (by email, set at apply time), existing playlists become `friends`.
- Replace the old open `using (true)` policies.

## Testing
- Local Supabase via the CLI on OrbStack, Postgres only (`supabase start` with other services excluded; the disk has about 10 GB free).
- pgTAP tests (`supabase test db`) per scenario: registration with valid, used, expired, revoked code and with registration closed or terms missing; quota limit; stranger cannot read a `friends` playlist; friend can; anyone active can read `public`; `private` is owner only; disabled user reads nothing; user cannot change own `role`/`disabled`; one partner per user; partner requires acceptance; `listen_scope = partner` blocks a non-partner friend on `pair:*`; global switch off blocks all `pair:*`; `admin_list_users` refuses non-admins; `delete_my_account` cascades.
- Vitest for the TypeScript side: error mapping, local cache, visibility in the library migration and upsert.

## Known limitation
With email confirmation off there is no self-service password reset. A user who forgets their password asks the admin, who resets it from the Supabase dashboard. Email-based reset comes with custom SMTP later.

## Out of scope
UI redesign and new screens (C), web and admin panel (B), offline audio, user search, email confirmation and password reset by email, per-friend Listen Together switches, group listening rooms.
