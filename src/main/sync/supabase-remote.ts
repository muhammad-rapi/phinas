import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AppConfig,
  Friend,
  FriendRequest,
  InviteCode,
  LikeEntry,
  ListenScope,
  MyProfile,
  PartnerPlaylist,
  PlaylistWithTracks,
  SignUpInput,
  Track,
  Visibility,
} from "../../shared/types";
import type { LibrarySnapshot } from "../library/merge";
import type { Remote } from "./engine";
import { FileStorage } from "./file-storage";

/** PostgREST returns at most this many rows per request (`max_rows` in supabase/config.toml). */
const PAGE = 1000;

interface TrackRow {
  video_id: string;
  title: string;
  artist: string;
  cover_url: string;
  duration_sec: number;
  position?: number;
}

const toRow = (t: Track): TrackRow => ({
  video_id: t.videoId,
  title: t.title,
  artist: t.artist,
  cover_url: t.coverUrl,
  duration_sec: t.durationSec,
});

const fromRow = (r: TrackRow): Track => ({
  videoId: r.video_id,
  title: r.title,
  artist: r.artist,
  coverUrl: r.cover_url,
  durationSec: r.duration_sec,
});

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

interface PlaylistRow {
  id: string;
  name: string;
  updated_at: string;
  visibility: Visibility;
  owner_id: string;
  profiles: { display_name: string } | null;
  playlist_tracks: TrackRow[];
}

const PLAYLIST_SELECT =
  "id, name, updated_at, visibility, owner_id, profiles(display_name), playlist_tracks(position, video_id, title, artist, cover_url, duration_sec)";

function toPartnerPlaylist(r: PlaylistRow): PartnerPlaylist {
  const tracks = [...r.playlist_tracks]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map(fromRow);
  return {
    id: r.id,
    name: r.name,
    updatedAt: new Date(r.updated_at).getTime(),
    visibility: r.visibility,
    ownerId: r.owner_id,
    ownerName: r.profiles?.display_name ?? "Teman",
    coverUrls: tracks
      .slice(0, 4)
      .map((t) => t.coverUrl)
      .filter(Boolean),
    tracks,
  };
}

export class SupabaseRemote implements Remote {
  private sb: SupabaseClient;

  constructor(url: string, anonKey: string, sessionFile: string) {
    this.sb = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: new FileStorage(sessionFile),
      },
    });
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.sb.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new Error(error.message);
  }

  /** Checks the invite first: Supabase Auth hides the trigger's own message behind a generic error. */
  async signUp(input: SignUpInput): Promise<void> {
    if (!input.acceptedTerms) throw new Error("phinas:terms_required");
    const status = await this.rpc<string>("check_invite", {
      p_code: input.inviteCode,
    });
    if (status !== "ok") throw new Error(`phinas:${status}`);
    const { error } = await this.sb.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: {
          display_name: input.displayName.trim(),
          invite_code: input.inviteCode.trim().toUpperCase(),
          accepted_terms: true,
        },
      },
    });
    if (error) {
      if (/database error/i.test(error.message))
        throw new Error("phinas:signup_failed");
      throw new Error(error.message);
    }
  }

  private async rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.sb.rpc(fn, args);
    if (error) throw new Error(error.message);
    return data as T;
  }

  myProfile(): Promise<MyProfile> {
    return this.rpc("my_profile");
  }

  async updateMyProfile(
    displayName: string | null,
    listenScope: ListenScope | null,
  ): Promise<void> {
    await this.rpc("update_my_profile", {
      p_display_name: displayName,
      p_listen_scope: listenScope,
    });
  }

  getConfig(): Promise<AppConfig> {
    return this.rpc("get_config");
  }

  listFriends(): Promise<Friend[]> {
    return this.rpc("list_friends");
  }

  listFriendRequests(): Promise<FriendRequest[]> {
    return this.rpc("list_friend_requests");
  }

  async sendFriendRequest(friendCode: string): Promise<void> {
    await this.rpc("send_friend_request", { p_friend_code: friendCode });
  }

  async respondFriendRequest(
    friendshipId: string,
    accept: boolean,
  ): Promise<void> {
    await this.rpc("respond_friend_request", {
      p_id: friendshipId,
      p_accept: accept,
    });
  }

  async removeFriend(friendshipId: string): Promise<void> {
    await this.rpc("remove_friend", { p_id: friendshipId });
  }

  async requestPartner(friendshipId: string): Promise<void> {
    await this.rpc("request_partner", { p_id: friendshipId });
  }

  async respondPartner(friendshipId: string, accept: boolean): Promise<void> {
    await this.rpc("respond_partner", { p_id: friendshipId, p_accept: accept });
  }

  async endPartner(friendshipId: string): Promise<void> {
    await this.rpc("end_partner", { p_id: friendshipId });
  }

  listMyInvites(): Promise<InviteCode[]> {
    return this.rpc("list_my_invites");
  }

  createInvite(): Promise<string> {
    return this.rpc("create_invite");
  }

  async revokeInvite(code: string): Promise<void> {
    await this.rpc("revoke_invite", { p_code: code });
  }

  async deleteAccount(): Promise<void> {
    await this.rpc("delete_my_account");
    await this.sb.auth.signOut({ scope: "local" });
  }

  async signOut(): Promise<void> {
    await this.sb.auth.signOut();
  }

  /** The stored session (no network call), so it also works offline. */
  async session(): Promise<{ email?: string; userId: string } | null> {
    const { data } = await this.sb.auth.getSession();
    return data.session
      ? { email: data.session.user.email, userId: data.session.user.id }
      : null;
  }

  async userId(): Promise<string> {
    const { data } = await this.sb.auth.getUser();
    if (!data.user) throw new Error("Not signed in");
    return data.user.id;
  }

  /** The raw client, for the realtime channel. */
  get client(): SupabaseClient {
    return this.sb;
  }

  /** Stores the playlist and replaces its tracks in one transaction (replace_playlist RPC). */
  async upsertPlaylist(p: PlaylistWithTracks): Promise<void> {
    await this.rpc("replace_playlist", {
      p: {
        id: p.id,
        name: p.name,
        visibility: p.visibility,
        updated_at: new Date(p.updatedAt).toISOString(),
        tracks: p.tracks.map(toRow),
      },
    });
  }

  async deletePlaylist(id: string): Promise<void> {
    await this.userId();
    check(await this.sb.from("playlists").delete().eq("id", id));
  }

  /** Replaces the account's likes in one transaction (replace_likes RPC). */
  async replaceLikes(likes: LikeEntry[]): Promise<void> {
    await this.rpc("replace_likes", {
      p: likes.map((l) => ({
        ...toRow(l),
        liked_at: new Date(l.likedAt).toISOString(),
      })),
    });
  }

  /** Every row of a query, a page at a time. `page` must order the rows by a unique key. */
  private async allRows<T>(
    page: (
      from: number,
      to: number,
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  ): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await page(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      const got = (data ?? []) as T[];
      rows.push(...got);
      if (got.length < PAGE) return rows;
    }
  }

  /** The account's own playlists (with tracks) and likes. Own rows are readable under RLS. */
  async pullLibrary(): Promise<LibrarySnapshot> {
    const me = await this.userId();
    // A disabled account reads nothing under RLS; merging that empty answer would delete this
    // computer's playlists. my_profile() still answers for a disabled account.
    if ((await this.myProfile()).disabled) throw new Error("phinas:account_disabled");
    const lists = await this.allRows<{
      id: string;
      name: string;
      updated_at: string;
      visibility: Visibility;
    }>((from, to) =>
      this.sb
        .from("playlists")
        .select("id, name, updated_at, visibility")
        .eq("owner_id", me)
        .order("id")
        .range(from, to),
    );
    const ids = lists.map((p) => p.id);
    const tracks: (TrackRow & { playlist_id: string })[] = [];
    // Chunks keep the `in (...)` filter inside the URL length limit.
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      tracks.push(
        ...(await this.allRows<TrackRow & { playlist_id: string }>(
          (from, to) =>
            this.sb
              .from("playlist_tracks")
              .select(
                "playlist_id, position, video_id, title, artist, cover_url, duration_sec",
              )
              .in("playlist_id", chunk)
              .order("playlist_id")
              .order("position")
              .range(from, to),
        )),
      );
    }
    const byPlaylist = new Map<string, Track[]>();
    for (const r of tracks) {
      const list = byPlaylist.get(r.playlist_id) ?? [];
      list.push(fromRow(r));
      byPlaylist.set(r.playlist_id, list);
    }
    const likes = await this.allRows<TrackRow & { liked_at: string }>(
      (from, to) =>
        this.sb
          .from("liked_tracks")
          .select("video_id, title, artist, cover_url, duration_sec, liked_at")
          .eq("owner_id", me)
          .order("video_id")
          .range(from, to),
    );
    return {
      playlists: lists.map((p) => {
        const list = byPlaylist.get(p.id) ?? [];
        return {
          id: p.id,
          name: p.name,
          updatedAt: new Date(p.updated_at).getTime(),
          visibility: p.visibility,
          coverUrls: list
            .slice(0, 4)
            .map((t) => t.coverUrl)
            .filter(Boolean),
          tracks: list,
        };
      }),
      likes: likes
        .map((l) => ({ ...fromRow(l), likedAt: new Date(l.liked_at).getTime() }))
        .sort((a, b) => b.likedAt - a.likedAt),
    };
  }

  /** Playlists of one friend, or of every friend. RLS already hides private ones. */
  async listFriendPlaylists(friendId?: string): Promise<PartnerPlaylist[]> {
    const ids = friendId
      ? [friendId]
      : (await this.listFriends()).map((f) => f.userId);
    if (ids.length === 0) return [];
    const rows = check(
      await this.sb
        .from("playlists")
        .select(PLAYLIST_SELECT)
        .in("owner_id", ids)
        .order("updated_at", { ascending: false }),
    ) as unknown as PlaylistRow[];
    return rows.map(toPartnerPlaylist);
  }

  /** Public playlists of every other user. */
  async listPublicPlaylists(): Promise<PartnerPlaylist[]> {
    const me = await this.userId();
    const rows = check(
      await this.sb
        .from("playlists")
        .select(PLAYLIST_SELECT)
        .eq("visibility", "public")
        .neq("owner_id", me)
        .order("updated_at", { ascending: false })
        .limit(100),
    ) as unknown as PlaylistRow[];
    return rows.map(toPartnerPlaylist);
  }
}
