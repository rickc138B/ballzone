'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type Season = {
  pts: number; reb: number; ast: number; stl: number; blk: number
  games_played: number; fg_pct: number; three_pct: number
}

type GameLog = {
  game_id: string | null
  game_date: string
  opponent_abbr: string | null
  home_abbr: string | null
  away_abbr: string | null
  home_score: number | null
  away_score: number | null
  pts: number; reb: number; ast: number; stl: number; blk: number; tov: number
  fgm: number; fga: number; three_pm: number; three_pa: number; ftm: number; fta: number
  minutes: string
}

type PlayerData = {
  player: {
    id: string; name: string; nationality: string | null; photo_url: string | null
    team: { id: string; name: string; abbreviation: string }
  }
  season: Season | null
  career_high: GameLog | null
  game_log: GameLog[]
}

function fmtPct(val: number) {
  return val ? (val * 100).toFixed(1) + '%' : '-'
}

export default function ProPlayerPage() {
  const { slug, playerId } = useParams() as { slug: string; playerId: string }
  const [following, setFollowing] = useState<boolean | null>(null)
  const [followLoading, setFollowLoading] = useState(false)

  async function toggleFollow() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('bz_profile_token') : null
    if (!token) { window.location.href = '/profile'; return }
    setFollowLoading(true)
    try {
      const res = await fetch('/api/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-profile-token': token },
        body: JSON.stringify({ target_id: playerId, target_type: 'player' }),
      })
      const d = await res.json()
      setFollowing(d.following)
    } finally { setFollowLoading(false) }
  }
  const [data, setData] = useState<PlayerData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/pro/${slug}/player/${playerId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [slug, playerId])

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('bz_profile_token') : null
    if (!token) return
    fetch(`/api/follows?target_id=${playerId}&target_type=player`, { headers: { 'x-profile-token': token } })
      .then(r => r.json()).then(d => setFollowing(d.following ?? false))
  }, [playerId])

  if (loading) return (
    <main className="min-h-dvh flex items-center justify-center">
      <div className="text-white/40">Loading...</div>
    </main>
  )

  if (!data?.player) return (
    <main className="min-h-dvh flex items-center justify-center">
      <div className="text-white/40">Player not found</div>
    </main>
  )

  const { player, season, career_high, game_log } = data

  return (
    <main className="min-h-dvh flex flex-col max-w-lg mx-auto px-5 pb-16">
      <div className="pt-6 mb-6">
        <Link href={`/pro/${slug}`} className="text-white/30 text-sm flex items-center gap-1.5 mb-6">
          ← Back to {slug.toUpperCase()}
        </Link>

        {/* Player header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/20 border border-orange-500/30
                          overflow-hidden flex items-center justify-center text-3xl flex-shrink-0">
            {player.photo_url
              ? <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
              : <span>🏀</span>}
          </div>
          <div>
            <h1 className="text-2xl font-black text-white leading-tight">{player.name}</h1>
            <p className="text-orange-400 text-sm font-medium mt-0.5">{player.team?.name}</p>
            {player.nationality && (
              <p className="text-white/20 text-xs mt-0.5">{player.nationality}</p>
            )}
            <button
              onClick={toggleFollow}
              disabled={followLoading}
              className={`mt-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95
                ${following ? 'bg-white/10 text-white/60 border border-white/20' : 'bg-orange-500 text-white'}
                ${followLoading ? 'opacity-50' : ''}`}
            >
              {followLoading ? '...' : following ? '✓ Following' : '+ Follow'}
            </button>
          </div>
        </div>

        {!season ? (
          <p className="text-white/30 text-sm text-center py-8">No stats available</p>
        ) : (
          <>
            {/* Career high */}
            {career_high && (
              <div className="card p-4 border-orange-500/20 mb-4">
                <p className="text-orange-400 text-xs uppercase tracking-wider font-semibold mb-2">🔥 Season High</p>
                <div className="flex items-end gap-3">
                  <div>
                    <span className="text-4xl font-black text-white">{career_high.pts}</span>
                    <span className="text-white/40 text-sm ml-1">PTS</span>
                  </div>
                  <div className="text-white/50 text-sm pb-1">
                    {career_high.reb} REB · {career_high.ast} AST
                  </div>
                </div>
                <p className="text-white/30 text-xs mt-1">
                  {career_high.opponent_abbr ? `vs ${career_high.opponent_abbr} · ` : ''}
                  {new Date(career_high.game_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            )}

            {/* Season averages */}
            <div className="card p-4 mb-4">
              <p className="text-white/30 text-xs uppercase tracking-wider mb-3">
                Season Averages · {season.games_played} GP
              </p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'PPG', value: season.pts },
                  { label: 'RPG', value: season.reb },
                  { label: 'APG', value: season.ast },
                  { label: 'SPG', value: season.stl },
                  { label: 'BPG', value: season.blk },
                  { label: 'GP', value: season.games_played },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <div className="text-xl font-black text-white tabular-nums">{value}</div>
                    <div className="text-white/30 text-xs mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/10">
                {[
                  { label: 'FG%', value: fmtPct(season.fg_pct) },
                  { label: '3P%', value: fmtPct(season.three_pct) },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <div className="text-lg font-bold text-orange-400 tabular-nums">{value}</div>
                    <div className="text-white/30 text-xs mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Game log */}
            <p className="text-white/30 text-xs uppercase tracking-wider mb-3">Game Log</p>
            <div className="space-y-2">
              {game_log.map((g, i) => {
                const isHigh = career_high && g.pts === career_high.pts && i === 0
                const dateStr = new Date(g.game_date).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short'
                })
                const scoreStr = g.home_abbr && g.away_abbr && g.home_score != null
                  ? `${g.away_abbr} ${g.away_score} @ ${g.home_abbr} ${g.home_score}`
                  : null

                const card = (
                  <div className="card p-3 active:bg-white/5 transition-colors">
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {g.opponent_abbr && (
                          <span className="text-white/40 text-xs">vs {g.opponent_abbr}</span>
                        )}
                        {isHigh && <span className="text-orange-400 text-xs">🔥 High</span>}
                      </div>
                      <span className="text-white/20 text-xs">{dateStr}</span>
                    </div>
                    {scoreStr && (
                      <p className="text-white/20 text-xs mb-1.5">{scoreStr}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex gap-3 text-xs tabular-nums">
                        <span className="text-orange-400 font-black text-sm">{g.pts}</span>
                        <span className="text-white/50">{g.reb}r</span>
                        <span className="text-white/50">{g.ast}a</span>
                        {g.stl > 0 && <span className="text-white/40">{g.stl}s</span>}
                        {g.blk > 0 && <span className="text-white/40">{g.blk}b</span>}
                        {g.tov > 0 && <span className="text-red-400/60">{g.tov}to</span>}
                      </div>
                      <span className="text-white/20 text-xs">
                        {g.fgm}/{g.fga} · {g.three_pm}/{g.three_pa} 3P · {g.minutes}
                      </span>
                    </div>
                  </div>
                )

                return g.game_id ? (
                  <Link key={`${g.game_date}-${i}`} href={`/pro/${slug}/game/${g.game_id}`}>
                    {card}
                  </Link>
                ) : (
                  <div key={`${g.game_date}-${i}`}>{card}</div>
                )
              })}
              {game_log.length === 0 && (
                <p className="text-white/20 text-sm text-center py-8">No game log available</p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
