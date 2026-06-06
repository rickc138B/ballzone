'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

const EMOJIS = ['🔥', '💪', '😤', '👑', '🎯', '💀', '🍿', '🫡']

type PlayerGameStat = {
  id: string; name: string
  pts: number; reb: number; ast: number; stl: number; blk: number; tov: number
  fgm: number; fga: number; three_pm: number; three_pa: number; ftm: number; fta: number
  minutes: string
}

type GameDetail = {
  id: string; game_date: string; status: string
  home_team: { id: string; name: string; abbreviation: string }
  away_team: { id: string; name: string; abbreviation: string }
  home_score: number; away_score: number
  home_players: PlayerGameStat[]; away_players: PlayerGameStat[]
}

type Comment = { id: string; author_name: string; body: string; created_at: string }
type Clip = { id: string; url: string; platform: string; caption: string | null; added_by: string; created_at: string }

function fmtPct(made: number, att: number) {
  if (!att) return '-'
  return ((made / att) * 100).toFixed(0) + '%'
}

const PLATFORM_ICONS: Record<string, string> = {
  tiktok: '🎵', instagram: '📸', twitter: '🐦', youtube: '▶️', other: '🔗',
}

function detectPlatform(url: string): string {
  if (url.includes('tiktok.com')) return 'tiktok'
  if (url.includes('instagram.com')) return 'instagram'
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  return 'other'
}

function BoxScoreTable({ players, teamName, score, won, slug }: {
  players: PlayerGameStat[]; teamName: string; score: number; won: boolean; slug: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          {won && <span className="text-yellow-400 text-sm">👑</span>}
          <span className={`font-black text-base ${won ? 'text-white' : 'text-white/40'}`}>{teamName}</span>
        </div>
        <span className={`text-3xl font-black tabular-nums ${won ? 'text-orange-400' : 'text-white/25'}`}>{score}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-white/20 uppercase tracking-wider border-b border-white/10">
              <th className="text-left px-4 py-2 min-w-[120px]">Player</th>
              <th className="text-center px-2 py-2">MIN</th>
              <th className="text-center px-2 py-2 text-orange-400">PTS</th>
              <th className="text-center px-2 py-2">REB</th>
              <th className="text-center px-2 py-2">AST</th>
              <th className="text-center px-2 py-2">STL</th>
              <th className="text-center px-2 py-2">BLK</th>
              <th className="text-center px-2 py-2">TOV</th>
              <th className="text-center px-2 py-2">FG</th>
              <th className="text-center px-2 py-2">FG%</th>
              <th className="text-center px-2 py-2">3P</th>
              <th className="text-center px-2 py-2">3P%</th>
              <th className="text-center px-2 py-2">FT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {players.map(p => (
              <tr key={p.id}>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <Link href={`/pro/${slug}/player/${p.id}`} className="font-semibold text-white active:text-orange-400">{p.name}</Link>
                </td>
                <td className="text-center px-2 py-2.5 text-white/30">{p.minutes}</td>
                <td className="text-center px-2 py-2.5 text-orange-400 font-black">{p.pts}</td>
                <td className="text-center px-2 py-2.5 text-white/70">{p.reb}</td>
                <td className="text-center px-2 py-2.5 text-white/70">{p.ast}</td>
                <td className="text-center px-2 py-2.5 text-white/70">{p.stl}</td>
                <td className="text-center px-2 py-2.5 text-white/70">{p.blk}</td>
                <td className="text-center px-2 py-2.5 text-red-400/70">{p.tov}</td>
                <td className="text-center px-2 py-2.5 text-white/40">{p.fgm}/{p.fga}</td>
                <td className="text-center px-2 py-2.5 text-white/40">{fmtPct(p.fgm, p.fga)}</td>
                <td className="text-center px-2 py-2.5 text-white/40">{p.three_pm}/{p.three_pa}</td>
                <td className="text-center px-2 py-2.5 text-white/40">{fmtPct(p.three_pm, p.three_pa)}</td>
                <td className="text-center px-2 py-2.5 text-white/40">{p.ftm}/{p.fta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function GameDetailPage() {
  const { slug, gameId } = useParams() as { slug: string; gameId: string }
  const [game, setGame] = useState<GameDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'box' | 'comments' | 'clips'>('box')

  const [reactions, setReactions] = useState<Record<string, number>>({})
  const [myReactions, setMyReactions] = useState<Record<string, boolean>>({})

  const [comments, setComments] = useState<Comment[]>([])
  const [commentName, setCommentName] = useState('')
  const [commentBody, setCommentBody] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const [clips, setClips] = useState<Clip[]>([])
  const [clipUrl, setClipUrl] = useState('')
  const [clipCaption, setClipCaption] = useState('')
  const [clipName, setClipName] = useState('')
  const [showAddClip, setShowAddClip] = useState(false)
  const [submittingClip, setSubmittingClip] = useState(false)

  useEffect(() => {
    // Live score polling
    let pollInterval: ReturnType<typeof setInterval> | null = null

    const loadGame = () => fetch(`/api/pro/${slug}/games/${gameId}`)
      .then(r => r.json())
      .then(d => {
        setGame(d.game)
        setLoading(false)
        if (d.game && !d.game.status?.toLowerCase().includes('final')) {
          if (pollInterval) clearInterval(pollInterval)
          pollInterval = setInterval(async () => {
            try {
              const res = await fetch(`/api/pro/${slug}/games/${gameId}/live`)
              if (!res.ok) return
              const live = await res.json()
              if (live.error) return
              setGame(prev => prev ? { ...prev, home_score: live.homeScore, away_score: live.awayScore, status: live.status } : prev)
              if (live.status?.toLowerCase().includes('final') && pollInterval) {
                clearInterval(pollInterval)
                loadGame() // reload full box score when final
              }
            } catch {}
          }, 30000)
        }
      })

    loadGame()
    fetch(`/api/pro/${slug}/games/${gameId}/react`)
      .then(r => r.json()).then(setReactions)
    fetch(`/api/pro/${slug}/games/${gameId}/comments`)
      .then(r => r.json()).then(setComments)
    fetch(`/api/pro/${slug}/games/${gameId}/clips`)
      .then(r => r.json()).then(d => setClips(Array.isArray(d) ? d : []))
    const stored = localStorage.getItem(`proReactions:${gameId}`)
    if (stored) setMyReactions(JSON.parse(stored))
    const name = localStorage.getItem('ballzone:commentName')
    if (name) { setCommentName(name); setClipName(name) }
    return () => { if (pollInterval) clearInterval(pollInterval) }
  }, [slug, gameId])

  async function react(emoji: string) {
    if (myReactions[emoji]) return
    const updated = { ...myReactions, [emoji]: true }
    setMyReactions(updated)
    localStorage.setItem(`proReactions:${gameId}`, JSON.stringify(updated))
    setReactions(r => ({ ...r, [emoji]: (r[emoji] ?? 0) + 1 }))
    await fetch(`/api/pro/${slug}/games/${gameId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji, author_name: commentName || 'Anonymous' }),
    })
  }

  async function submitComment() {
    if (!commentBody.trim()) return
    setSubmittingComment(true)
    const name = commentName.trim() || 'Anonymous'
    localStorage.setItem('ballzone:commentName', name)
    const res = await fetch(`/api/pro/${slug}/games/${gameId}/comments`, {
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
    setSubmittingComment(false)
  }

  async function submitClip() {
    if (!clipUrl.trim()) return
    setSubmittingClip(true)
    const name = clipName.trim() || 'Anonymous'
    localStorage.setItem('ballzone:commentName', name)
    const res = await fetch(`/api/pro/${slug}/games/${gameId}/clips`, {
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

  const homeWon = game.home_score > game.away_score
  const dateStr = new Date(game.game_date).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  const totals = (players: PlayerGameStat[]) => ({
    fgm: players.reduce((s, p) => s + p.fgm, 0),
    fga: players.reduce((s, p) => s + p.fga, 0),
    three_pm: players.reduce((s, p) => s + p.three_pm, 0),
    three_pa: players.reduce((s, p) => s + p.three_pa, 0),
    reb: players.reduce((s, p) => s + p.reb, 0),
    ast: players.reduce((s, p) => s + p.ast, 0),
  })
  const homeT = totals(game.home_players)
  const awayT = totals(game.away_players)

  return (
    <main className="min-h-dvh flex flex-col max-w-2xl mx-auto pb-32">
      <div className="pt-6 px-4">
        <Link href={`/pro/${slug}`} className="text-white/30 text-sm flex items-center gap-1.5 active:text-white/60">
          ← Back to {slug.toUpperCase()}
        </Link>
      </div>

      {/* Score header */}
      <div className="px-4 pt-4 pb-6">
        <p className="text-white/20 text-xs mb-4 text-center">{dateStr}</p>
        <div className="card p-5">
          <div className="flex items-center justify-between gap-4">
            <div className={`flex-1 text-center ${!homeWon ? 'opacity-100' : 'opacity-40'}`}>
              <p className="text-white font-black text-base leading-tight">{game.away_team.name}</p>
              <p className="text-white/30 text-xs mt-0.5">{game.away_team.abbreviation}</p>
              <p className={`text-5xl font-black tabular-nums mt-3 ${!homeWon ? 'text-orange-400' : 'text-white/20'}`}>{game.away_score}</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-white/10 text-2xl font-black">—</span>
              <span className="text-white/20 text-xs uppercase tracking-widest">Final</span>
              <span className="text-white/10 text-2xl font-black">—</span>
            </div>
            <div className={`flex-1 text-center ${homeWon ? 'opacity-100' : 'opacity-40'}`}>
              <p className="text-white font-black text-base leading-tight">{game.home_team.name}</p>
              <p className="text-white/30 text-xs mt-0.5">{game.home_team.abbreviation} · HME</p>
              <p className={`text-5xl font-black tabular-nums mt-3 ${homeWon ? 'text-orange-400' : 'text-white/20'}`}>{game.home_score}</p>
            </div>
          </div>
          <div className="mt-5 pt-4 border-t border-white/10 space-y-2">
            {[
              { label: 'FG%', awayVal: awayT.fga ? awayT.fgm/awayT.fga : 0, homeVal: homeT.fga ? homeT.fgm/homeT.fga : 0, away: fmtPct(awayT.fgm, awayT.fga), home: fmtPct(homeT.fgm, homeT.fga) },
              { label: '3P%', awayVal: awayT.three_pa ? awayT.three_pm/awayT.three_pa : 0, homeVal: homeT.three_pa ? homeT.three_pm/homeT.three_pa : 0, away: fmtPct(awayT.three_pm, awayT.three_pa), home: fmtPct(homeT.three_pm, homeT.three_pa) },
              { label: 'REB', awayVal: awayT.reb, homeVal: homeT.reb, away: awayT.reb, home: homeT.reb },
              { label: 'AST', awayVal: awayT.ast, homeVal: homeT.ast, away: awayT.ast, home: homeT.ast },
            ].map(row => {
              const total = row.awayVal + row.homeVal
              const awayPct = total ? (row.awayVal / total) * 100 : 50
              return (
                <div key={row.label} className="flex items-center gap-2 text-xs">
                  <span className={`w-10 text-right tabular-nums font-bold ${!homeWon ? 'text-orange-400' : 'text-white/50'}`}>{row.away}</span>
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden flex">
                    <div className="h-full bg-orange-500/60 rounded-full" style={{ width: `${awayPct}%` }} />
                  </div>
                  <span className={`w-10 tabular-nums font-bold ${homeWon ? 'text-orange-400' : 'text-white/50'}`}>{row.home}</span>
                  <span className="w-8 text-center text-white/20">{row.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="px-4">
        {/* Reactions */}
        <div className="flex gap-2 flex-wrap mb-4">
          {EMOJIS.map(emoji => (
            <button key={emoji} onClick={() => react(emoji)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-all
                ${myReactions[emoji]
                  ? 'bg-orange-500/20 border border-orange-500/40 text-white'
                  : 'bg-white/5 border border-white/10 text-white/50 active:scale-95'}`}>
              {emoji} {reactions[emoji] ? <span className="text-xs tabular-nums">{reactions[emoji]}</span> : null}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {(['box', 'comments', 'clips'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all
                ${tab === t ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/50'}`}>
              {t === 'box' ? '📊 Box Score' : t === 'comments' ? `💬 Comments${comments.length ? ` (${comments.length})` : ''}` : `🎬 Clips${clips.length ? ` (${clips.length})` : ''}`}
            </button>
          ))}
        </div>

        {/* Box Score */}
        {tab === 'box' && (
          <div className="space-y-4 mb-4">
            <div className="card overflow-hidden">
              <BoxScoreTable players={game.away_players} teamName={game.away_team.name} score={game.away_score} won={!homeWon} slug={slug} />
            </div>
            <div className="card overflow-hidden">
              <BoxScoreTable players={game.home_players} teamName={game.home_team.name} score={game.home_score} won={homeWon} slug={slug} />
            </div>
          </div>
        )}

        {/* Comments */}
        {tab === 'comments' && (
          <div className="space-y-3 mb-4">
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
              <div key={clip.id} className="card p-4 border-white/5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{PLATFORM_ICONS[clip.platform] ?? '🔗'}</span>
                  <a href={clip.url} target="_blank" rel="noopener noreferrer"
                    className="text-orange-400 text-sm truncate flex-1 active:opacity-70">
                    {clip.caption || clip.url}
                  </a>
                  <span className="text-white/20 text-xs flex-shrink-0">↗</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/30 text-xs">{clip.added_by}</span>
                  <span className="text-white/20 text-xs">
                    {new Date(clip.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </div>
            ))}
            {clips.length === 0 && !showAddClip && (
              <p className="text-white/20 text-sm text-center py-8">No clips yet</p>
            )}
          </div>
        )}
      </div>

      {/* Comment input sticky bottom */}
      {tab === 'comments' && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0f0f1a]/95 backdrop-blur border-t border-white/10">
          <div className="max-w-2xl mx-auto space-y-2">
            <input value={commentName} onChange={e => setCommentName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2
                         text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-orange-500/50" />
            <div className="flex gap-2">
              <input value={commentBody} onChange={e => setCommentBody(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitComment()}
                placeholder="Say something..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2
                           text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-orange-500/50" />
              <button onClick={submitComment} disabled={!commentBody.trim() || submittingComment}
                className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold disabled:opacity-30">
                {submittingComment ? '...' : '↑'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
