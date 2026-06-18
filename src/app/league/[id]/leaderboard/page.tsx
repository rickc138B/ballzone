'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type Player = {
  player_id: string
  display_name: string
  photo_url: string | null
  team_name: string
  team_id: string
  gp: number
  ppg: number; rpg: number; apg: number; spg: number; bpg: number; tpg: number
  fg_pct: number; three_pct: number; ft_pct: number
  total_pts: number
}

type SortKey = 'ppg' | 'rpg' | 'apg' | 'spg' | 'bpg' | 'fg_pct' | 'three_pct'

const CATEGORIES: { key: SortKey; label: string; unit?: string }[] = [
  { key: 'ppg',      label: 'Points',   unit: 'PPG' },
  { key: 'rpg',      label: 'Rebounds', unit: 'RPG' },
  { key: 'apg',      label: 'Assists',  unit: 'APG' },
  { key: 'spg',      label: 'Steals',   unit: 'SPG' },
  { key: 'bpg',      label: 'Blocks',   unit: 'BPG' },
  { key: 'fg_pct',   label: 'FG%',      unit: '%'   },
  { key: 'three_pct',label: '3PT%',     unit: '%'   },
]

export default function LeaderboardPage() {
  const { id: leagueId } = useParams() as { id: string }
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortKey>('ppg')
  const [leagueTitle, setLeagueTitle] = useState('')

  useEffect(() => {
    fetch(`/api/leagues/${leagueId}/leaderboard`)
      .then(r => r.json())
      .then(d => { setPlayers(Array.isArray(d) ? d : []); setLoading(false) })
    fetch(`/api/leagues/${leagueId}`)
      .then(r => r.json())
      .then(d => setLeagueTitle(d.league?.title ?? ''))
  }, [leagueId])

  const sorted = [...players]
    .filter(p => p.gp > 0)
    .sort((a, b) => b[sort] - a[sort])

  const top3 = sorted.slice(0, 3)
  const rest = sorted.slice(3)

  const medal = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'

  return (
    <main className="min-h-dvh flex flex-col p-5 max-w-lg mx-auto pb-10">
      <div className="pt-4 mb-6">
        <Link href={`/league/${leagueId}`} className="text-white/40 text-sm mb-4 block">← {leagueTitle || 'League'}</Link>
        <p className="text-orange-400 text-xs uppercase tracking-wider font-semibold mb-1">🏆 Leaderboard</p>
        <h1 className="text-2xl font-black text-white">Top Performers</h1>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 no-scrollbar">
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setSort(c.key)}
            className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all
              ${sort === c.key ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/50'}`}>
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-white/40">Loading...</div>
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-white/40">No stats recorded yet</p>
        </div>
      ) : (
        <>
          {/* Top 3 podium */}
          {top3.length > 0 && (
            <div className="space-y-2 mb-4">
              {top3.map((p, i) => (
                <Link key={p.player_id} href={`/league/${leagueId}/player/${p.player_id}`}>
                  <div className={`card p-4 border flex items-center gap-3 active:opacity-70
                    ${i === 0 ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-white/10'}`}>
                    <span className="text-2xl w-8 text-center">{medal(i)}</span>
                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/20
                                    flex items-center justify-center overflow-hidden flex-shrink-0">
                      {p.photo_url
                        ? <img src={p.photo_url} alt={p.display_name} className="w-full h-full object-cover" />
                        : <span className="text-sm">🏀</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate">{p.display_name}</p>
                      <p className="text-white/40 text-xs">{p.team_name} · {p.gp} GP</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-black text-xl ${i === 0 ? 'text-yellow-400' : 'text-orange-400'}`}>
                        {p[sort]}{sort.includes('pct') ? '%' : ''}
                      </p>
                      <p className="text-white/30 text-xs">{CATEGORIES.find(c => c.key === sort)?.unit}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Rest of leaderboard */}
          {rest.length > 0 && (
            <div className="card overflow-hidden">
              <div className="grid grid-cols-12 px-4 py-2 border-b border-white/5">
                <span className="text-white/30 text-xs col-span-1">#</span>
                <span className="text-white/30 text-xs col-span-7">Player</span>
                <span className="text-white/30 text-xs col-span-2 text-center">GP</span>
                <span className="text-white/30 text-xs col-span-2 text-right">{CATEGORIES.find(c => c.key === sort)?.unit}</span>
              </div>
              {rest.map((p, i) => (
                <Link key={p.player_id} href={`/league/${leagueId}/player/${p.player_id}`}>
                  <div className="grid grid-cols-12 px-4 py-3 border-b border-white/5 last:border-0 active:bg-white/5">
                    <span className="text-white/30 text-sm col-span-1">{i + 4}</span>
                    <div className="col-span-7 flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {p.photo_url
                          ? <img src={p.photo_url} alt={p.display_name} className="w-full h-full object-cover" />
                          : <span className="text-xs">🏀</span>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{p.display_name}</p>
                        <p className="text-white/30 text-xs truncate">{p.team_name}</p>
                      </div>
                    </div>
                    <span className="text-white/40 text-sm col-span-2 text-center self-center">{p.gp}</span>
                    <span className="text-orange-400 font-bold text-sm col-span-2 text-right self-center">
                      {p[sort]}{sort.includes('pct') ? '%' : ''}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  )
}
