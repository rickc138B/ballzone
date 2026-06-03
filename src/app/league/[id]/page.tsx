'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type Team = { id: string; name: string }
type Game = {
  id: string
  sequence_number: number
  round_label: string | null
  played_at: string | null
  home_score: number | null
  away_score: number | null
  location_name: string | null
  home_team: Team | null
  away_team: Team | null
}
type Standing = {
  id: string
  name: string
  w: number
  l: number
  gp: number
  pts_for: number
  pts_against: number
}
type LeagueData = {
  league: { id: string; title: string; season: string | null; location_name: string | null; description: string | null }
  games: Game[]
  standings: Standing[]
}

export default function LeaguePage() {
  const { id } = useParams() as { id: string }
  const [data, setData] = useState<LeagueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'games' | 'standings'>('standings')

  useEffect(() => {
    fetch(`/api/leagues/${id}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [id])

  if (loading) return (
    <main className="min-h-dvh flex items-center justify-center">
      <div className="text-white/40 text-lg">Loading...</div>
    </main>
  )

  if (!data?.league) return (
    <main className="min-h-dvh flex items-center justify-center">
      <div className="text-white/40">League not found</div>
    </main>
  )

  const { league, games, standings } = data

  return (
    <main className="min-h-dvh flex flex-col p-5 max-w-lg mx-auto">
      {/* Header */}
      <div className="pt-4 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-orange-400 text-xs uppercase tracking-wider font-semibold mb-1">🏆 League</p>
            <h1 className="text-2xl font-black text-white leading-tight">{league.title}</h1>
            {league.season && <p className="text-white/40 text-sm mt-0.5">Season {league.season}</p>}
            {league.location_name && <p className="text-white/40 text-sm">📍 {league.location_name}</p>}
            {league.description && <p className="text-white/40 text-sm mt-1 italic">{league.description}</p>}
          </div>
          <div className="text-3xl">🏆</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {(['standings', 'games'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all
              ${tab === t ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/50'}`}
          >
            {t === 'standings' ? '📊 Standings' : '🏀 Games'}
          </button>
        ))}
      </div>

      {/* Standings */}
      {tab === 'standings' && (
        <div className="card p-4 mb-5">
          {standings.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-4">No games yet</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-white/30 text-xs uppercase tracking-wider">
                  <th className="text-left pb-3">Team</th>
                  <th className="text-center pb-3">GP</th>
                  <th className="text-center pb-3">W</th>
                  <th className="text-center pb-3">L</th>
                  <th className="text-center pb-3">+/-</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {standings.map((s, i) => (
                  <tr key={s.id} className="text-sm">
                    <td className="py-2.5 flex items-center gap-2">
                      {i === 0 && <span className="text-yellow-400 text-xs">👑</span>}
                      <span className={i === 0 ? 'text-white font-semibold' : 'text-white/60'}>{s.name}</span>
                    </td>
                    <td className="text-center text-white/40">{s.gp}</td>
                    <td className="text-center text-green-400 font-bold">{s.w}</td>
                    <td className="text-center text-red-400">{s.l}</td>
                    <td className="text-center text-white/40">
                      {s.pts_for - s.pts_against > 0 ? '+' : ''}{s.pts_for - s.pts_against}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Games */}
      {tab === 'games' && (
        <div className="space-y-3 mb-5">
          {games.length === 0 && (
            <p className="text-white/30 text-sm text-center py-8">No games yet</p>
          )}
          {games.map(g => {
            const homeWon = (g.home_score ?? 0) > (g.away_score ?? 0)
            return (
              <Link key={g.id} href={`/league/${id}/game/${g.id}`}>
                <div className="card p-4 border-white/10 active:bg-white/5 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/30 text-xs">
                      {g.round_label ?? `Game ${g.sequence_number}`}
                    </span>
                    {g.played_at && (
                      <span className="text-white/20 text-xs">
                        {new Date(g.played_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { team: g.home_team, score: g.home_score, won: homeWon },
                      { team: g.away_team, score: g.away_score, won: !homeWon },
                    ].map(({ team, score, won }) => (
                      <div key={team?.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {won && <span className="text-yellow-400 text-xs">👑</span>}
                          <span className={won ? 'text-white font-semibold text-sm' : 'text-white/50 text-sm'}>
                            {team?.name ?? '—'}
                          </span>
                        </div>
                        <span className={won ? 'text-orange-400 font-black text-lg tabular-nums' : 'text-white/30 font-black text-lg tabular-nums'}>
                          {score ?? '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        <Link
          href={`/league/${id}/backfill`}
          className="w-full py-3 rounded-2xl font-bold text-sm bg-white/10 text-white
                     border border-white/10 flex items-center justify-center active:bg-white/20"
        >
          📋 Add Game Result
        </Link>
      </div>
    </main>
  )
}
