import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
  Visibility,
} from "../../shared/types";
import type { Remote } from "./engine";
import { FileStorage } from "./file-storage";

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

  /** The partner, when Listen Together is allowed with them; otherwise null. */
  async pairInfo(): Promise<ListenInfo | null> {
    const me = await this.userId();
    const partner = (await this.listFriends()).find(
      (f) => f.isPartner && f.canListen,
    );
    return partner
      ? { me, partnerId: partner.userId, partnerName: partner.name }
      : null;
  }

  async upsertPlaylist(p: PlaylistWithTracks): Promise<void> {
    await this.userId();
    check(
      await this.sb.from("playlists").upsert({
        id: p.id,
        name: p.name,
        visibility: p.visibility,
        updated_at: new Date(p.updatedAt).toISOString(),
      }),
    );
    check(
      await this.sb.from("playlist_tracks").delete().eq("playlist_id", p.id),
    );
    if (p.tracks.length) {
      check(
        await this.sb
          .from("playlist_tracks")
          .insert(
            p.tracks.map((t, i) => ({
              playlist_id: p.id,
              position: i,
              ...toRow(t),
            })),
          ),
      );
    }
  }

  async deletePlaylist(id: string): Promise<void> {
    await this.userId();
    check(await this.sb.from("playlists").delete().eq("id", id));
  }

  async replaceLikes(tracks: Track[]): Promise<void> {
    const me = await this.userId();
    check(await this.sb.from("liked_tracks").delete().eq("owner_id", me));
    if (tracks.length)
      check(await this.sb.from("liked_tracks").insert(tracks.map(toRow)));
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

  /** Bridge for the Berdua tab until the redesign: the partner's playlists. */
  async listPartnerPlaylists(): Promise<PartnerPlaylist[]> {
    const partner = (await this.listFriends()).find((f) => f.isPartner);
    return partner ? this.listFriendPlaylists(partner.userId) : [];
  }
}
