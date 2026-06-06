'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import GameShareCard from '@/components/GameShareCard'

const EMOJIS = ['🔥', '💪', '😤', '👑', '🎯', '💀', '🍿', '🫡']

type PlayerStat = {
  id: string; league_player_id: string; display_name: string
  pts: number; reb: number; ast: number; blk: number; stl: number; tov: number
  fga: number; fgm: number; three_pa: number; three_pm: number; fta: number; ftm: number
}
type TeamBox = { id: string; name: string; score: number; players: PlayerStat[] }
type GameDetail = {
  id: string; round_label: string | null; played_at: string | null; location_name: string | null
  home_team: TeamBox; away_team: TeamBox
  home_score: number | null; away_score: number | null; recap_image_url: string | null; league: { title: string } | null
}
type Comment = { id: string; author_name: string; body: string; created_at: string }

export default function LeagueGamePage() {
  const { id: leagueId, gameId } = useParams() as { id: string; gameId: string }
  const [game, setGame] = useState<GameDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTeam, setActiveTeam] = useState<'home' | 'away'>('home')
  const [tab, setTab] = useState<'box' | 'comments' | 'clips'>('box')
  const [clips, setClips] = useState<{id:string;url:string;platform:string;embed_html:string|null;caption:string|null;added_by:string;created_at:string}[]>([])
  const [clipUrl, setClipUrl] = useState('')
  const [clipCaption, setClipCaption] = useState('')
  const [clipName, setClipName] = useState('')
  const [showAddClip, setShowAddClip] = useState(false)
  const [submittingClip, setSubmittingClip] = useState(false)

  // Admin photo upload
  const [showPhotoUpload, setShowPhotoUpload] = useState(false)
  const [adminPin, setAdminPin] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState('')

  // Reactions
  const [reactions, setReactions] = useState<Record<string, number>>({})
  const [myReactions, setMyReactions] = useState<Record<string, boolean>>({})

  // Comments
  const [comments, setComments] = useState<Comment[]>([])
  const [commentName, setCommentName] = useState('')
  const [commentBody, setCommentBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/leagues/${leagueId}/game/${gameId}`)
      .then(r => r.json()).then(d => { setGame(d); setLoading(false) })
    fetch(`/api/leagues/${leagueId}/game/${gameId}/react`)
      .then(r => r.json()).then(setReactions)
    fetch(`/api/leagues/${leagueId}/game/${gameId}/comments`)
      .then(r => r.json()).then(setComments)

    const stored = localStorage.getItem(`lgReactions:${gameId}`)
    if (stored) setMyReactions(JSON.parse(stored))
    const name = localStorage.getItem('ballzone:commentName')
    if (name) { setCommentName(name); setClipName(name) }
    fetch(`/api/leagues/${leagueId}/game/${gameId}/clips`)
      .then(r => r.json()).then(d => setClips(Array.isArray(d) ? d : []))
  }, [leagueId, gameId])

  async function react(emoji: string) {
    if (myReactions[emoji]) return
    const name = commentName || 'Anonymous'
    const updated = { ...myReactions, [emoji]: true }
    setMyReactions(updated)
    localStorage.setItem(`lgReactions:${gameId}`, JSON.stringify(updated))
    setReactions(r => ({ ...r, [emoji]: (r[emoji] ?? 0) + 1 }))
    await fetch(`/api/leagues/${leagueId}/game/${gameId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji, author_name: name }),
    })
  }

  async function submitComment() {
    if (!commentBody.trim()) return
    setSubmitting(true)
    const name = commentName.trim() || 'Anonymous'
    localStorage.setItem('ballzone:commentName', name)
    const res = await fetch(`/api/leagues/${leagueId}/game/${gameId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author_name: name, body: commentBody.trim() }),
    })
    if (res.ok) {
      const c = await res.json()
      setComments(prev => [...prev, c])
      setCommentBody('')
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
    setSubmitting(false)
  }

  async function uploadGamePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !adminPin.trim()) return
    setUploadingPhoto(true); setPhotoError('')
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const ext = file.name.split('.').pop()
    const uploadPath = `${gameId}/recap-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('recap-images').upload(uploadPath, file, { upsert: true })
    if (upErr) { setPhotoError('Upload failed'); setUploadingPhoto(false); return }
    const { data: { publicUrl } } = supabase.storage.from('recap-images').getPublicUrl(uploadPath)
    const res = await fetch(`/api/leagues/${leagueId}/game/${gameId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: adminPin, recap_image_url: publicUrl }),
    })
    if (!res.ok) { setPhotoError('Save failed — check PIN'); setUploadingPhoto(false); return }
    setGame(g => g ? { ...g, recap_image_url: publicUrl } : g)
    setShowPhotoUpload(false)
    setUploadingPhoto(false)
  }

  const PLATFORM_ICONS: Record<string, string> = {
    tiktok: '🎵', instagram: '📸', twitter: '🐦', youtube: '▶️', other: '🔗',
  }

  async function submitClip() {
    if (!clipUrl.trim()) return
    setSubmittingClip(true)
    const name = clipName.trim() || 'Anonymous'
    localStorage.setItem('ballzone:commentName', name)
    const res = await fetch(`/api/leagues/${leagueId}/game/${gameId}/clips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: clipUrl.trim(), caption: clipCaption.trim(), added_by: name }),
    })
    if (res.ok) {
      const c = await res.json()
      setClips(prev => [c, ...prev])
      setClipUrl(''); setClipCaption(''); setShowAddClip(false)
    }
    setSubmittingClip(false)
  }

  if (loading) return (
    <main className="min-h-dvh flex items-center justify-center">
      <div className="text-white/40 text-lg">Loading...</div>
    </main>
  )
  if (!game) return (
    <main className="min-h-dvh flex items-center justify-center">
      <div className="text-white/40">Game not found</div>
    </main>
  )

  const isScheduled = game.home_team.score === null && game.away_team.score === null
  const homeWon = !isScheduled && game.home_team.score > game.away_team.score
  const displayTeam = activeTeam === 'home' ? game.home_team : game.away_team
  const topScorer = [...(game.home_team.players ?? []), ...(game.away_team.players ?? [])]
    .sort((a, b) => b.pts - a.pts)[0]

  return (
    <main className="min-h-dvh flex flex-col p-5 max-w-lg mx-auto pb-32">
      <div className="pt-4 mb-5">
        <Link href={`/league/${leagueId}`} className="text-white/40 text-sm mb-4 block">← League</Link>
        {game.round_label && <p className="text-orange-400 text-xs uppercase tracking-wider mb-1">{game.round_label}</p>}
        {game.played_at && (
          <p className="text-white/30 text-xs mb-3">
            {new Date(game.played_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {game.location_name ? ` · ${game.location_name}` : ''}
          </p>
        )}

        {/* Live scoring CTA for scheduled games */}
        {isScheduled && (
          <Link
            href={`/league/${leagueId}/game/${gameId}/live`}
            className="w-full mb-4 py-3.5 rounded-2xl font-bold bg-green-500 text-white
                       flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            ▶ Start Live Scoring
          </Link>
        )}

        {/* Recap image */}
        {game.recap_image_url && (
          <div className="relative w-full rounded-2xl overflow-hidden mb-4" style={{aspectRatio:'1'}}>
            <img src={game.recap_image_url} alt="Game recap" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <p className="text-white/50 text-xs uppercase tracking-wider mb-0.5">Final</p>
              <p className="text-white font-black text-xl">{homeWon ? game.home_team.name : game.away_team.name} wins</p>
              <p className="text-orange-400 font-black text-4xl">{game.home_score}–{game.away_score}</p>
            </div>
          </div>
        )}

        {/* Admin photo upload — shown when no recap image exists */}
        {!game.recap_image_url && (
          <div className="mb-3">
            {!showPhotoUpload ? (
              <button
                onClick={() => setShowPhotoUpload(true)}
                className="w-full py-2.5 rounded-2xl border border-dashed border-white/10
                           text-white/20 text-xs active:bg-white/5 transition-colors"
              >
                📸 Add game photo
              </button>
            ) : (
              <div className="card p-3 border-white/10 space-y-2">
                <input
                  type="password"
                  value={adminPin}
                  onChange={e => setAdminPin(e.target.value)}
                  placeholder="Admin PIN"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2
                             text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-orange-500/50"
                />
                <label className={`flex items-center justify-center w-full py-2.5 rounded-xl text-sm
                                  border transition-colors cursor-pointer
                                  ${!adminPin.trim() || uploadingPhoto
                                    ? 'border-white/10 text-white/20 cursor-not-allowed'
                                    : 'border-orange-500/40 text-orange-400 active:bg-orange-500/10'}`}>
                  {uploadingPhoto ? 'Uploading...' : '📸 Choose photo'}
                  <input type="file" accept="image/*" className="hidden"
                         onChange={uploadGamePhoto}
                         disabled={!adminPin.trim() || uploadingPhoto} />
                </label>
                {photoError && <p className="text-red-400 text-xs">{photoError}</p>}
                <button onClick={() => { setShowPhotoUpload(false); setPhotoError('') }}
                        className="w-full text-white/20 text-xs py-1">Cancel</button>
              </div>
            )}
          </div>
        )}

        {/* Score card */}
        <div className="card p-4 border-white/10 mb-3">
          <div className="space-y-2">
            {[{ team: game.home_team, won: homeWon }, { team: game.away_team, won: !homeWon }].map(({ team, won }) => (
              <div key={team.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {won && <span className="text-yellow-400 text-xs">👑</span>}
                  <span className={won ? 'text-white font-bold' : 'text-white/50'}>{team.name}</span>
                </div>
                <span className={won ? 'text-orange-400 font-black text-2xl tabular-nums' : 'text-white/30 font-black text-2xl tabular-nums'}>
                  {isScheduled ? 'TBD' : team.score}
                </span>
              </div>
            ))}
          </div>
          {topScorer && (
            <p className="text-white/30 text-xs mt-3 pt-3 border-t border-white/10">
              🔥 {topScorer.display_name} · {topScorer.pts}pts {topScorer.reb}reb {topScorer.ast}ast
            </p>
          )}
        </div>

        {/* Share Card */}
        {!isScheduled && (
          <div className="mb-4">
            <GameShareCard
              leagueName={game.league?.title}
              roundLabel={game.round_label}
              homeTeam={{ name: game.home_team.name, score: game.home_team.score }}
              awayTeam={{ name: game.away_team.name, score: game.away_team.score }}
              homePlayers={game.home_team.players}
              awayPlayers={game.away_team.players}
              playedAt={game.played_at}
              locationName={game.location_name}
            />
          </div>
        )}

        {/* Reactions */}
        <div className="flex gap-2 flex-wrap mb-4">
          {EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => react(emoji)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-all
                ${myReactions[emoji]
                  ? 'bg-orange-500/20 border border-orange-500/40 text-white'
                  : 'bg-white/5 border border-white/10 text-white/50 active:scale-95'}`}
            >
              {emoji} {reactions[emoji] ? <span className="text-xs tabular-nums">{reactions[emoji]}</span> : null}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {(['box', 'comments', 'clips'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all
                ${tab === t ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/50'}`}
            >
              {t === 'box' ? '📊 Box Score' : t === 'comments' ? `💬 Comments${comments.length ? ` (${comments.length})` : ''}` : `🎬 Clips${clips.length ? ` (${clips.length})` : ''}`}
            </button>
          ))}
        </div>

        {/* Box Score */}
        {tab === 'box' && (
          <>
            <div className="flex gap-2 mb-3">
              {(['home', 'away'] as const).map(side => {
                const t = side === 'home' ? game.home_team : game.away_team
                return (
                  <button key={side} onClick={() => setActiveTeam(side)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all
                      ${activeTeam === side ? 'bg-white/20 text-white' : 'bg-white/5 text-white/40'}`}>
                    {t.name}
                  </button>
                )
              })}
            </div>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-white/30 uppercase tracking-wider border-b border-white/10">
                      <th className="text-left px-3 py-2">Player</th>
                      <th className="text-center px-2 py-2">PTS</th>
                      <th className="text-center px-2 py-2">REB</th>
                      <th className="text-center px-2 py-2">AST</th>
                      <th className="text-center px-2 py-2">STL</th>
                      <th className="text-center px-2 py-2">BLK</th>
                      <th className="text-center px-2 py-2">FG</th>
                      <th className="text-center px-2 py-2">3P</th>
                      <th className="text-center px-2 py-2">FT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(displayTeam.players ?? []).sort((a, b) => b.pts - a.pts).map(p => (
                      <tr key={p.id} className="text-white/70">
                        <td className="px-3 py-2.5 whitespace-nowrap"><Link href={`/league/${leagueId}/player/${p.league_player_id}`} className="font-semibold text-white active:text-orange-400">{p.display_name}</Link></td>
                        <td className="text-center px-2 py-2.5 text-orange-400 font-bold">{p.pts}</td>
                        <td className="text-center px-2 py-2.5">{p.reb}</td>
                        <td className="text-center px-2 py-2.5">{p.ast}</td>
                        <td className="text-center px-2 py-2.5">{p.stl}</td>
                        <td className="text-center px-2 py-2.5">{p.blk}</td>
                        <td className="text-center px-2 py-2.5 tabular-nums">{p.fgm}/{p.fga}</td>
                        <td className="text-center px-2 py-2.5 tabular-nums">{p.three_pm}/{p.three_pa}</td>
                        <td className="text-center px-2 py-2.5 tabular-nums">{p.ftm}/{p.fta}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Comments */}
        {tab === 'comments' && (
          <div className="space-y-3">
            {comments.length === 0 && (
              <p className="text-white/20 text-sm text-center py-6">No comments yet. Be first.</p>
            )}
            {comments.map(c => (
              <div key={c.id} className="card p-3 border-white/5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-orange-400 text-xs font-semibold">{c.author_name}</span>
                  <span className="text-white/20 text-xs">
                    {new Date(c.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-white/70 text-sm">{c.body}</p>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Clips */}
      {tab === 'clips' && (
        <div className="space-y-4 mb-4">
          {!showAddClip ? (
            <button onClick={() => setShowAddClip(true)}
              className="w-full py-3 rounded-2xl border border-dashed border-white/20
                         text-white/40 text-sm active:bg-white/5">
              + Add a clip
            </button>
          ) : (
            <div className="card p-4 space-y-3 border-orange-500/20">
              <p className="text-white/60 text-sm font-semibold">Share a clip</p>
              <input value={clipUrl} onChange={e => setClipUrl(e.target.value)}
                placeholder="Paste TikTok, Instagram, YouTube or Twitter link"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5
                           text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-orange-500/50" />
              <input value={clipCaption} onChange={e => setClipCaption(e.target.value)}
                placeholder="Caption (optional)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5
                           text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-orange-500/50" />
              <input value={clipName} onChange={e => setClipName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5
                           text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-orange-500/50" />
              <div className="flex gap-2">
                <button onClick={submitClip} disabled={!clipUrl.trim() || submittingClip}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold disabled:opacity-30">
                  {submittingClip ? 'Adding...' : 'Add Clip'}
                </button>
                <button onClick={() => setShowAddClip(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/10 text-white/40 text-sm">Cancel</button>
              </div>
            </div>
          )}
          {clips.map(clip => (
            <div key={clip.id} className="card overflow-hidden border-white/5">
              {clip.embed_html ? (
                <div className="w-full overflow-hidden"
                  dangerouslySetInnerHTML={{ __html: clip.embed_html }} />
              ) : (
                <a href={clip.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 active:bg-white/5">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl flex-shrink-0">
                    {PLATFORM_ICONS[clip.platform] ?? '🔗'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-orange-400 text-xs font-semibold mb-0.5">{clip.platform}</p>
                    <p className="text-white/50 text-xs truncate">{clip.url}</p>
                  </div>
                  <span className="text-white/20 text-xs">↗</span>
                </a>
              )}
              <div className="px-4 pt-3 pb-2">
                {clip.caption && <p className="text-white/70 text-sm mb-2">{clip.caption}</p>}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-white/30 text-xs">{clip.added_by}</span>
                    <span className="text-white/10 text-xs">·</span>
                    <span className="text-white/20 text-xs">{new Date(clip.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  </div>
                  <div className="flex gap-2">
                    <a href={clip.url} target="_blank" rel="noopener noreferrer"
                      className="text-white/20 text-xs border border-white/10 rounded-lg px-2 py-1 active:bg-white/5">
                      View original ↗
                    </a>
                    <button onClick={() => { if (navigator.share) { navigator.share({ title: clip.caption ?? 'Ballzone clip', text: '🏀 ' + (clip.caption ?? 'Sick clip'), url: window.location.href }) } else { navigator.clipboard.writeText(window.location.href) } }}
                      className="text-white/20 text-xs border border-white/10 rounded-lg px-2 py-1 active:bg-white/5">
                      📤 Share
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {clips.length === 0 && !showAddClip && (
            <p className="text-white/20 text-sm text-center py-8">No clips yet</p>
          )}
        </div>
      )}

      {/* Comment input — sticky bottom */}
      {tab === 'comments' && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0f0f1a]/95 backdrop-blur border-t border-white/10">
          <div className="max-w-lg mx-auto space-y-2">
            <input
              value={commentName}
              onChange={e => setCommentName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2
                         text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-orange-500/50"
            />
            <div className="flex gap-2">
              <input
                value={commentBody}
                onChange={e => setCommentBody(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitComment()}
                placeholder="Say something..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2
                           text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-orange-500/50"
              />
              <button
                onClick={submitComment}
                disabled={!commentBody.trim() || submitting}
                className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold
                           disabled:opacity-30 active:scale-95 transition-transform"
              >
                {submitting ? '...' : '↑'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
