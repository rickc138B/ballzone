'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type PlayerSeason = {
  id: string
  pts: number; reb: number; ast: number; stl: number; blk: number
  games_played: number; fg_pct: number; three_pct: number
  player: { id: string; name: string; nationality: string | null; photo_url: string | null }
  team: { id: string; name: string; abbreviation: string }
}

type Team = {
  id: string; name: string; abbreviation: string; logo_url: string | null
}

type ProLeagueData = {
  league: { id: string; name: string; slug: string; season: string; region: string }
  players: PlayerSeason[]
  teams: Team[]
}

const STAT_CATS = ['pts', 'reb', 'ast', 'stl', 'blk'] as const
type StatCat = typeof STAT_CATS[number]

const STAT_LABELS: Record<StatCat, string> = {
  pts: 'Points', reb: 'Rebounds', ast: 'Assists', stl: 'Steals', blk: 'Blocks'
}

export default function ProLeaguePage() {
  const { slug } = useParams() as { slug: string }
  const [data, setData] = useState<ProLeagueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'leaders' | 'teams'>('leaders')
  const [statCat, setStatCat] = useState<StatCat>('pts')

  useEffect(() => {
    fetch(`/api/pro/${slug}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [slug])

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

  const { league, players, teams } = data
  const sorted = [...players].sort((a, b) => (b[statCat] ?? 0) - (a[statCat] ?? 0))

  return (
    <main className="min-h-dvh flex flex-col max-w-lg mx-auto pb-16">
      {/* Header */}
      <div className="pt-16 pb-6 px-5 border-b border-white/5">
        <p className="text-orange-400 text-xs uppercase tracking-wider font-semibold mb-1">🏀 Pro League</p>
        <h1 className="text-3xl font-black text-white">{league.name}</h1>
        <p className="text-white/30 text-sm mt-0.5">Season {league.season}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-5 pt-4 mb-4">
        {(['leaders', 'teams'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all
              ${tab === t ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/50'}`}>
            {t === 'leaders' ? '📊 Leaders' : '🏀 Teams'}
          </button>
        ))}
      </div>

      <div className="px-5">
        {/* Leaders */}
        {tab === 'leaders' && (
          <>
            {/* Stat category selector */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {STAT_CATS.map(cat => (
                <button key={cat} onClick={() => setStatCat(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all
                    ${statCat === cat ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/40'}`}>
                  {STAT_LABELS[cat]}
                </button>
              ))}
            </div>

            {/* Leaderboard */}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-white/30 uppercase tracking-wider border-b border-white/10">
                      <th className="text-left px-3 py-2 w-6">#</th>
                      <th className="text-left px-3 py-2">Player</th>
                      <th className="text-center px-2 py-2">TM</th>
                      <th className="text-center px-2 py-2">GP</th>
                      <th className="text-center px-2 py-2 text-orange-400">{statCat.toUpperCase()}</th>
                      <th className="text-center px-2 py-2">PTS</th>
                      <th className="text-center px-2 py-2">REB</th>
                      <th className="text-center px-2 py-2">AST</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {sorted.slice(0, 50).map((p, i) => (
                      <tr key={p.id} className={`text-white/70 ${i < 3 ? 'bg-orange-500/5' : ''}`}>
                        <td className="px-3 py-2.5 text-white/20 font-mono">{i + 1}</td>
                        <td className="px-3 py-2.5">
                          <Link href={`/pro/${slug}/player/${p.player.id}`}
                            className="font-semibold text-white active:text-orange-400 whitespace-nowrap">
                            {p.player.name}
                          </Link>
                        </td>
                        <td className="text-center px-2 py-2.5 text-white/40">{p.team.abbreviation}</td>
                        <td className="text-center px-2 py-2.5 text-white/40">{p.games_played}</td>
                        <td className="text-center px-2 py-2.5 text-orange-400 font-black">{p[statCat]}</td>
                        <td className="text-center px-2 py-2.5">{p.pts}</td>
                        <td className="text-center px-2 py-2.5">{p.reb}</td>
                        <td className="text-center px-2 py-2.5">{p.ast}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Teams */}
        {tab === 'teams' && (
          <div className="grid grid-cols-2 gap-3">
            {teams.map(team => (
              <Link key={team.id} href={`/pro/${slug}/team/${team.id}`}>
                <div className="card p-4 flex flex-col items-center gap-2 active:bg-white/5 text-center">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl">
                    🏀
                  </div>
                  <p className="text-white text-xs font-bold leading-tight">{team.name}</p>
                  <p className="text-white/30 text-xs">{team.abbreviation}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
