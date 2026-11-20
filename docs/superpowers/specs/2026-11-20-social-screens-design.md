# Social screens (sub-project C2): design

Date: 2026-11-20
Status: approved in brainstorming

## Goal
Give the multi-user backend from sub-project A (`2026-11-20-multi-user-design.md`) its screens, in the editorial language of C1 (`2026-11-20-editorial-redesign-design.md`): sign-up and sign-in that a new friend can find, friends and friend codes, requests, partner, invites, playlist visibility, public playlists, Listen Together with any online friend, and a local library that belongs to one account. After C2 (and the A rollout) the app can be shared with friends.

The IPC and Supabase layer already exist (A): `syncSignUp`, `syncSignIn`, `syncSignOut`, `myProfile`, `updateMyProfile`, `getConfig`, `listFriends`, `listFriendRequests`, `sendFriendRequest`, `respondFriendRequest`, `removeFriend`, `requestPartner`, `respondPartner`, `endPartner`, `listMyInvites`, `createInvite`, `revokeInvite`, `deleteAccount`, `onlineFriends` + `onFriendsOnline`, `setPlaylistVisibility`, `listFriendPlaylists`, `listPublicPlaylists`, `openLegal`, events `listen:closed` and `account:changed`.

## Decisions
- **Library per account** (open decision from A): every account has its own local database on a computer; the pre-account library is claimed by the first account that signs in; signing in pulls the account's playlists and likes from the server.
- **Listen Together with any online friend** who allows it, one session at a time; a second invite is declined as busy.
- **One "Teman" page** replaces "Berdua" in the sidebar; the partner is its first row.
- **Online awareness everywhere:** an ONLINE group in the sidebar and a "Sedang online" line on Beranda.
- **Welcome screen** on first launch (Daftar / Masuk / Pakai tanpa akun); the app stays usable without an account.

## 1. Screens and navigation

### Welcome (first launch only)
Shown when the computer has never had a signed-in account and the user has not chosen "Pakai tanpa akun" (flag `welcomeDone` in the main-process settings). Full window, page wash, serif title "Selamat datang di *Phinas.*", a short line ("Dengar musik bareng teman dan pasanganmu."), and three buttons:
- **Punya kode undangan? Daftar** → the sign-up form (on the welcome screen itself).
- **Sudah punya akun? Masuk** → the sign-in form.
- **Pakai tanpa akun** → sets `welcomeDone` and opens Beranda.
Under them the T&C and privacy links (`openLegal`). A successful sign-in or sign-up also sets `welcomeDone`.

### Teman (`{ name: 'friends' }`, replaces `together`)
Sidebar item "Teman" with the Users icon; a red dot when there are incoming friend or partner requests.

Signed out: title "Teman", the line "Masuk untuk berteman dan dengar bareng.", and the same sign-in / sign-up forms as the welcome screen (one shared `AuthForm` component). If the computer's library was claimed by an account, the note "Playlist dan lagu yang kamu sukai tersimpan di akunmu. Masuk lagi untuk melihatnya."

Signed in, top to bottom:
1. Title "Teman *kamu*". A line with `Kode temanmu PHN-XXXXXX` + **Salin**, **Tambah teman** (inline field for a friend code + Kirim), **Undang** (creates a code; shows "n tersisa", nothing for admins).
2. **Pasangan** (when there is one): ♥, name, online state, **Dengar bareng** (when allowed), and the partner request state: incoming → Terima / Tolak; outgoing → "Menunggu…" + Batalkan (`endPartner` on the friendship, which clears the request).
3. **Permintaan** (only when any): incoming "X ingin berteman" → Terima / Tolak; outgoing "Menunggu X" → Batalkan (`removeFriend`).
4. **Teman**: numbered rows: online dot, name (opens the friend's profile), status ("online", "offline", "· bareng kamu"), and on the right **Ajak** (online and `canListen`) and **Lihat**. Partner excluded here (already above).
5. **Undangan** (only when any): each code with its state: aktif (expires in n days) + Salin + Cabut; "dipakai oleh X"; "kedaluwarsa"; "dicabut".
Errors from the RPCs show with `friendlyError` in a `.notice` under the section that caused them.

### Friend profile (`{ name: 'friend'; id: string }`)
Collection-header style: label `TEMAN` (or `PASANGAN`), serif title with the name, online state, then buttons: **Ajak dengar bareng** (when online and allowed), **Jadikan pasangan** / **Akhiri pasangan** / partner request state, and **Hapus teman** (confirm dialog). Below: their shared playlists (`listFriendPlaylists(id)`) as a cover grid; empty state "Belum membagikan playlist.". Opening a playlist uses the existing `partner` view, renamed `friendPlaylist`.

### Sidebar
- Navigation: Beranda, Jelajah, **Teman**, Disukai, Riwayat.
- **ONLINE · n** group (only when n > 0, signed in): up to 5 names, partner first with ♥, each with an online dot and "· bareng kamu" during a session; "+k lainnya" opens Teman. Clicking a name opens a small menu: **Ajak dengar bareng** (when allowed), **Lihat profil**.
- Playlist list: own playlists with a small visibility icon (lock for private, globe for public; nothing for friends), then **DARI TEMAN** (was "Dari pasangan"): friends' shared playlists, grouped by friend name.

### Beranda
The Berdua line becomes the **online line**: "Sedang online: Nadia, Sari, dan 1 lainnya" (partner first), with **Ajak** for the partner when online and allowed, otherwise for the first online allowed friend; names open their profiles. During a session it shows the session status and **Akhiri**. Hidden when signed out or nobody is online.

### Jelajah
New section **Playlist publik**: `listPublicPlaylists()` as a cover grid (title, "oleh {owner}"), up to 12; opens the friend-playlist view (read-only, Salin ke library saya). Only when signed in.

### Own playlist
The header label becomes a visibility picker: `🔒 PRIBADI` / `👥 TEMAN` / `🌐 PUBLIK` (lucide Lock / Users / Globe). Clicking opens a 3-item menu with one-line explanations ("Hanya kamu", "Semua temanmu", "Semua pengguna Phinas"). Uses `setPlaylistVisibility`; the change syncs through the outbox. New playlists default to Teman (already the case).

### Profil
- Display name: when signed in, saved to the server with `updateMyProfile(name, null)` (debounced 800 ms) and shown everywhere from `myProfile`; signed out it stays local.
- **Siapa yang boleh mengajak dengar bareng**: Semua teman / Pasangan saja / Tidak ada (`updateMyProfile(null, scope)`), with the note "Teman tetap bisa melihat kamu sedang online."
- Account: email, Keluar, Hapus akun (existing). The sign-in/sign-up forms move to Teman/Welcome; signed out, Profil shows a link "Masuk atau daftar di halaman Teman".

## 2. Listen Together with any friend

### Main process
- `PairChannel` (one partner) is replaced by **`PairHub`**: one private `pair:<a>:<b>` channel per friend who is online and `canListen`, at most 30. It reconciles when the friends list or the online set changes: opens channels for newly eligible friends, closes the others (pure helper `channelPlan(current, eligible, cap)` decides).
- Events to the renderer carry the friend: `listen:message` → `{ friendId, msg }`, `listen:presence` → `{ friendId, here }`, `listen:connection` → `{ friendId, up }`, `listen:closed` → `{ friendId, reason }`. `listenSend(friendId, msg)` targets one channel. `listenOpen`/`listenClose` are removed (the hub follows the friends list); `listenStatus()` returns the status per friend.
- The minute tick keeps closing channels that are no longer allowed (now per friend).

### Renderer
- `ListenTogetherProvider` keeps **one session at a time**: `activeFriend` + one `SyncSession` whose transport is routed to that friend's channel. The session protocol is unchanged.
- API: `invite(friendId)`, `accept()`, `decline()`, `end()`, `state`, `activeFriend`, `pendingInvite` ({ friendId, name } | null), `canInvite(friendId)`.
- Incoming `invite` from friend X: idle and no pending invite → `pendingInvite = X` (banner "X mengajak kamu dengar bareng" with Terima / Tolak; system notification with X's name when unfocused). In a session, or another invite pending → reply `decline` with reason `busy` on X's channel. Pure helper `routeInvite(state, from)` decides.
- The inviter seeing `decline` with `busy` shows "X sedang dengar bareng orang lain."
- Protocol: `decline` gains reason `busy`; the protocol version stays (older clients treat it as a plain decline).
- Player bar button: one click invites the partner when online and allowed; otherwise it opens a small list of online allowed friends.

## 3. Library per account

### Storage
- Per account: `userData/libraries/<userId>.db`. Without an account: `userData/phinas.db` (today's file).
- `settings.json` gains `claimedBy: string | null` (who took `phinas.db`) and `welcomeDone: boolean`.

### Switching (`LibraryHost` in main)
- Holds the active `Library` and rebuilds `SyncEngine` and `Recommender` when it changes; IPC handlers always read `host.library`.
- **Sign-in / sign-up** for user U:
  - `libraries/U.db` exists → open it.
  - Else if `claimedBy` is null and `phinas.db` exists → move it to `libraries/U.db`, set `claimedBy = U` (the pre-account library becomes U's).
  - Else → create an empty `libraries/U.db`.
  - Then **pull** (below), then send `account:changed`.
- **Sign-out / account deleted:** open `phinas.db` when `claimedBy` is null, otherwise a fresh empty guest database `libraries/guest.db` (cleared on every sign-out); send `account:changed`.
- App start: signed in → U's library (with the rules above), else the guest rules.

### Pull from the server
New remote call `pullLibrary()` → own playlists with tracks, visibility and `updated_at`, and own likes with `liked_at`. Merge (pure function `mergeLibrary(local, remote, pendingKeys)`, Vitest):
- Playlists by id. Both sides: newer `updated_at` wins, unless `playlist:<id>` is pending locally (local wins, it will push). Remote only: add. Local only and not pending: delete (deleted on another computer).
- Likes: if `likes` is pending locally, keep local; otherwise the server set wins.
- Runs on sign-in, at app start when signed in, and every 5 minutes. Play history stays local and per account.

## Error handling
- RPC refusals show `friendlyError` text inline next to the action. Network failures on the Teman page fall back to the cached friends list (A's cache) with a "Tidak terhubung" note; actions are disabled while offline.
- Library switch failures (file move, open) leave the previous library active and show a notice in Profil; nothing is deleted.
- A pull that fails keeps the local library unchanged and retries on the next tick.

## Testing
- Vitest: `channelPlan`, `routeInvite`, `mergeLibrary`, the claim rules (first sign-in claims, second account gets empty, sign-out → guest), `LibraryHost` switching with temp folders, the visibility picker's mapping, the online-line text (names, "dan n lainnya").
- Typecheck, build, the existing pgTAP suite.
- Manual: two accounts on the local stack (two app instances need two user-data folders; the dev script gains `PHINAS_PROFILE=<name>` to use `userData/<name>`), invite between non-partner friends, busy decline, library switch between accounts.

## Out of scope
Listening rooms (more than two), real-time library sync, syncing play history, user search, avatars/photos, push notifications when the app is closed, the web admin panel (B).
