'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

const EMOJIS = ['🔥', '💪', '😤', '👑', '🎯', '💀', '🍿', '🫡']

type PlayerStat = {
  id: string; display_name: string
  pts: number; reb: number; ast: number; blk: number; stl: number; tov: number
  fga: number; fgm: number; three_pa: number; three_pm: number; fta: number; ftm: number
}
type TeamBox = { id: string; name: string; score: number; players: PlayerStat[] }
type GameDetail = {
  id: string; round_label: string | null; played_at: string | null; location_name: string | null
  home_team: TeamBox; away_team: TeamBox
}
type Comment = { id: string; author_name: string; body: string; created_at: string }

export default function LeagueGamePage() {
  const { id: leagueId, gameId } = useParams() as { id: string; gameId: string }
  const [game, setGame] = useState<GameDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTeam, setActiveTeam] = useState<'home' | 'away'>('home')
  const [tab, setTab] = useState<'box' | 'comments'>('box')

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
    if (name) setCommentName(name)
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

  const homeWon = game.home_team.score > game.away_team.score
  const displayTeam = activeTeam === 'home' ? game.home_team : game.away_team
  const topScorer = [...game.home_team.players, ...game.away_team.players]
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
                  {team.score}
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
          {(['box', 'comments'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all
                ${tab === t ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/50'}`}
            >
              {t === 'box' ? '📊 Box Score' : `💬 Comments${comments.length ? ` (${comments.length})` : ''}`}
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
                    {displayTeam.players.sort((a, b) => b.pts - a.pts).map(p => (
                      <tr key={p.id} className="text-white/70">
                        <td className="px-3 py-2.5 whitespace-nowrap"><Link href={`/league/${leagueId}/player/${p.id}`} className="font-semibold text-white active:text-orange-400">{p.display_name}</Link></td>
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
