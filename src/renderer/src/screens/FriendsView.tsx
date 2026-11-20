import { Heart } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { friendlyError } from '../../../shared/errors'
import type { Friend, InviteCode } from '../../../shared/types'
import { AuthForm, type AuthMode } from '../components/AuthForm'
import { useSocial } from '../social/SocialProvider'
import { friendStatusText, inviteState, inviteText } from '../social/text'
import { useListen } from '../sync/ListenTogetherProvider'
import type { Nav } from '../views'

/** Where an action's error shows: under the part of the page that caused it. */
type Section = 'top' | 'partner' | 'requests' | 'invites'

const num = (i: number): string => String(i + 1).padStart(2, '0')

/** Copies to the clipboard; false when the system refused (the code is on screen anyway). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** A friend's name; opens their profile. */
function FriendName({ friend, nav }: { friend: Friend; nav: Nav }): React.JSX.Element {
  return (
    <button className="fr-name" onClick={() => nav({ name: 'friend', id: friend.userId })}>
      {friend.name}
    </button>
  )
}

/** Teman: sign in when signed out; otherwise friend code, partner, requests, friends and invites. */
export function FriendsView({ nav }: { nav: Nav }): React.JSX.Element {
  const social = useSocial()
  if (!social.loaded) return <h1 className="page-title">Teman</h1>
  if (!social.configured) {
    return (
      <>
        <h1 className="page-title">Teman</h1>
        <p className="muted">Supabase belum dikonfigurasi. Isi file .env lalu jalankan ulang app.</p>
      </>
    )
  }
  return social.signedIn ? <SignedIn nav={nav} /> : <SignedOut />
}

function SignedOut(): React.JSX.Element {
  const social = useSocial()
  const [mode, setMode] = useState<AuthMode>('in')
  const [claimed, setClaimed] = useState(false)

  useEffect(() => {
    window.phinas
      .syncStatus()
      .then((s) => setClaimed(s.libraryClaimed))
      .catch(() => undefined)
  }, [])

  return (
    <div className="friends">
      <h1 className="page-title">Teman</h1>
      <p className="muted">Masuk untuk berteman dan dengar bareng.</p>
      {claimed && <div className="notice">Playlist dan lagu yang kamu sukai tersimpan di akunmu. Masuk lagi untuk melihatnya.</div>}
      <section className="sec fr-auth">
        <AuthForm mode={mode} onMode={setMode} onDone={() => void social.refresh()} />
      </section>
    </div>
  )
}

function SignedIn({ nav }: { nav: Nav }): React.JSX.Element {
  const social = useSocial()
  const listen = useListen()
  const { me, friends, requests, online, offline, partner } = social
  const [errors, setErrors] = useState<Partial<Record<Section, string>>>({})
  const [working, setWorking] = useState(false)
  const [adding, setAdding] = useState(false)
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [invites, setInvites] = useState<InviteCode[]>([])
  const disabled = offline || working

  const loadInvites = useCallback(async () => {
    try {
      setInvites(await window.phinas.listMyInvites())
    } catch {
      // offline: keep the last list
    }
  }, [])

  useEffect(() => {
    void loadInvites()
  }, [loadInvites])

  /** Runs an action, shows its error under its own section, then reloads the lists. */
  const run = async (section: Section, action: () => Promise<unknown>): Promise<boolean> => {
    setErrors((e) => ({ ...e, [section]: undefined }))
    setWorking(true)
    try {
      await action()
      await social.refresh()
      return true
    } catch (err) {
      setErrors((e) => ({ ...e, [section]: friendlyError(err) }))
      return false
    } finally {
      setWorking(false)
    }
  }

  const copy = async (text: string): Promise<void> => {
    if (!(await copyText(text))) return
    setCopied(text)
    setTimeout(() => setCopied((c) => (c === text ? null : c)), 2000)
  }

  const sendRequest = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (!c) return
    if (await run('top', () => window.phinas.sendFriendRequest(c))) {
      setCode('')
      setAdding(false)
    }
  }

  const createInvite = async (): Promise<void> => {
    let created = ''
    const ok = await run('top', async () => {
      created = await window.phinas.createInvite()
    })
    if (!ok) return
    await loadInvites()
    await copy(created)
  }

  const err = (s: Section): React.JSX.Element | null =>
    errors[s] ? (
      <div className="notice" role="alert">
        {errors[s]}
      </div>
    ) : null
  const isOnline = (f: Friend): boolean => online.has(f.userId)
  const withYou = (f: Friend): boolean => listen.activeFriend === f.userId && listen.state.status === 'active'
  const partnerAsks = friends.filter((f) => !f.isPartner && f.partnerRequest !== null)
  const others = friends.filter((f) => !f.isPartner)
  const incoming = requests.filter((r) => r.incoming)
  const outgoing = requests.filter((r) => !r.incoming)
  const canInviteMore = me !== null && (me.invitesLeft === null || me.invitesLeft > 0)
  const now = Date.now()

  return (
    <div className="friends">
      <h1 className="page-title">
        Teman <em>kamu</em>
      </h1>
      {offline && (
        <div className="notice">Tidak terhubung. Ini daftar temanmu yang terakhir tersimpan; aksi bisa dipakai lagi setelah tersambung.</div>
      )}

      <div className="fr-top">
        <span className="label">Kode temanmu</span>
        <strong className="fr-code">{me?.friendCode ?? '…'}</strong>
        <button className="text-link" onClick={() => me && void copy(me.friendCode)} disabled={!me}>
          {me && copied === me.friendCode ? 'Tersalin' : 'Salin'}
        </button>
        <span className="fr-spacer" />
        <button className="btn secondary" onClick={() => setAdding((a) => !a)} disabled={disabled} aria-expanded={adding}>
          Tambah teman
        </button>
        <button className="btn secondary" onClick={() => void createInvite()} disabled={disabled || !canInviteMore}>
          Undang
        </button>
        {me && me.invitesLeft !== null && <span className="small muted">{me.invitesLeft} tersisa</span>}
      </div>
      {adding && (
        <form className="fr-add" onSubmit={sendRequest}>
          <input
            className="field"
            placeholder="Kode teman, mis. PHN-7K2Q9M"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            aria-label="Kode teman"
            autoFocus
          />
          <button className="btn" type="submit" disabled={disabled || !code.trim()}>
            Kirim
          </button>
        </form>
      )}
      {err('top')}

      {(partner || partnerAsks.length > 0) && (
        <section className="sec">
          <h2 className="section-title">Pasangan</h2>
          {partner && (
            <div className="fr-row">
              <Heart className="fr-heart" size={13} fill="currentColor" aria-label="Pasangan" />
              <span className={`online-dot${isOnline(partner) ? '' : ' off'}`} aria-hidden="true" />
              <FriendName friend={partner} nav={nav} />
              <span className="fr-status">{friendStatusText(isOnline(partner), withYou(partner))}</span>
              <span className="fr-spacer" />
              {isOnline(partner) && partner.canListen && !withYou(partner) && (
                <button className="text-link" onClick={() => listen.invite(partner.userId)} disabled={!listen.canInvite(partner.userId)}>
                  Dengar bareng
                </button>
              )}
            </div>
          )}
          {partnerAsks.map((f) => (
            <div key={f.userId} className="fr-row">
              <Heart className="fr-heart" size={13} aria-hidden="true" />
              <FriendName friend={f} nav={nav} />
              <span className="fr-status">{f.partnerRequest === 'incoming' ? 'ingin jadi pasanganmu' : 'Menunggu…'}</span>
              <span className="fr-spacer" />
              {f.partnerRequest === 'incoming' ? (
                <>
                  <button className="text-link" disabled={disabled} onClick={() => void run('partner', () => window.phinas.respondPartner(f.friendshipId, true))}>
                    Terima
                  </button>
                  <button className="text-link" disabled={disabled} onClick={() => void run('partner', () => window.phinas.respondPartner(f.friendshipId, false))}>
                    Tolak
                  </button>
                </>
              ) : (
                <button className="text-link" disabled={disabled} onClick={() => void run('partner', () => window.phinas.endPartner(f.friendshipId))}>
                  Batalkan
                </button>
              )}
            </div>
          ))}
          {err('partner')}
        </section>
      )}

      {requests.length > 0 && (
        <section className="sec">
          <h2 className="section-title">Permintaan</h2>
          {incoming.map((r) => (
            <div key={r.friendshipId} className="fr-row">
              <span className="fr-text">
                <strong>{r.name}</strong> ingin berteman
              </span>
              <span className="fr-spacer" />
              <button className="text-link" disabled={disabled} onClick={() => void run('requests', () => window.phinas.respondFriendRequest(r.friendshipId, true))}>
                Terima
              </button>
              <button className="text-link" disabled={disabled} onClick={() => void run('requests', () => window.phinas.respondFriendRequest(r.friendshipId, false))}>
                Tolak
              </button>
            </div>
          ))}
          {outgoing.map((r) => (
            <div key={r.friendshipId} className="fr-row">
              <span className="fr-text">
                Menunggu <strong>{r.name}</strong>
              </span>
              <span className="fr-spacer" />
              <button className="text-link" disabled={disabled} onClick={() => void run('requests', () => window.phinas.removeFriend(r.friendshipId))}>
                Batalkan
              </button>
            </div>
          ))}
          {err('requests')}
        </section>
      )}

      <section className="sec">
        <h2 className="section-title">Teman</h2>
        {others.length === 0 && <p className="muted">Belum ada teman. Bagikan kode temanmu, atau undang seseorang dengan kode undangan.</p>}
        <ol className="fr-list">
          {others.map((f, i) => (
            <li key={f.userId} className="fr-row">
              <span className="fr-num">{num(i)}</span>
              <span className={`online-dot${isOnline(f) ? '' : ' off'}`} aria-hidden="true" />
              <FriendName friend={f} nav={nav} />
              <span className="fr-status">{friendStatusText(isOnline(f), withYou(f))}</span>
              <span className="fr-spacer" />
              {isOnline(f) && f.canListen && !withYou(f) && (
                <button className="text-link" onClick={() => listen.invite(f.userId)} disabled={!listen.canInvite(f.userId)}>
                  Ajak
                </button>
              )}
              <button className="text-link" onClick={() => nav({ name: 'friend', id: f.userId })}>
                Lihat
              </button>
            </li>
          ))}
        </ol>
      </section>

      {invites.length > 0 && (
        <section className="sec">
          <h2 className="section-title">Undangan</h2>
          {invites.map((inv) => {
            const st = inviteState(inv, now)
            return (
              <div key={inv.code} className="fr-row">
                <strong className="fr-code">{inv.code}</strong>
                <span className="fr-status">{inviteText(st)}</span>
                <span className="fr-spacer" />
                {st.kind === 'active' && (
                  <>
                    <button className="text-link" onClick={() => void copy(inv.code)}>
                      {copied === inv.code ? 'Tersalin' : 'Salin'}
                    </button>
                    <button
                      className="text-link"
                      disabled={disabled}
                      onClick={() =>
                        void run('invites', async () => {
                          await window.phinas.revokeInvite(inv.code)
                          await loadInvites()
                        })
                      }
                    >
                      Cabut
                    </button>
                  </>
                )}
              </div>
            )
          })}
          {err('invites')}
        </section>
      )}
    </div>
  )
}
