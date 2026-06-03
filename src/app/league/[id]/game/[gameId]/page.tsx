'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type PlayerStat = {
  id: string
  display_name: string
  pts: number; reb: number; ast: number; blk: number; stl: number; tov: number
  fga: number; fgm: number; three_pa: number; three_pm: number; fta: number; ftm: number
}
type TeamBox = { id: string; name: string; score: number; players: PlayerStat[] }
type GameDetail = {
  id: string
  round_label: string | null
  played_at: string | null
  location_name: string | null
  home_team: TeamBox
  away_team: TeamBox
}

export default function LeagueGamePage() {
  const { id: leagueId, gameId } = useParams() as { id: string; gameId: string }
  const [game, setGame] = useState<GameDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTeam, setActiveTeam] = useState<'home' | 'away'>('home')

  useEffect(() => {
    fetch(`/api/leagues/${leagueId}/game/${gameId}`)
      .then(r => r.json())
      .then(d => { setGame(d); setLoading(false) })
  }, [leagueId, gameId])

  if (loading) return (
    <main className="min-h-dvh flex items-center justify-center">
      <div className="text-white/40">Loading...</div>
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
    <main className="min-h-dvh flex flex-col p-5 max-w-lg mx-auto">
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
        <div className="card p-4 border-white/10 mb-4">
          <div className="space-y-2">
            {[
              { team: game.home_team, won: homeWon },
              { team: game.away_team, won: !homeWon },
            ].map(({ team, won }) => (
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

        {/* Team tabs */}
        <div className="flex gap-2 mb-4">
          {(['home', 'away'] as const).map(side => {
            const t = side === 'home' ? game.home_team : game.away_team
            return (
              <button
                key={side}
                onClick={() => setActiveTeam(side)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all
                  ${activeTeam === side ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/50'}`}
              >
                {t.name}
              </button>
            )
          })}
        </div>

        {/* Box score */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/30 uppercase tracking-wider border-b border-white/10">
                  <th className="text-left px-3 py-2 font-semibold">Player</th>
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
                {displayTeam.players
                  .sort((a, b) => b.pts - a.pts)
                  .map(p => (
                    <tr key={p.id} className="text-white/70">
                      <td className="px-3 py-2.5 font-semibold text-white whitespace-nowrap">{p.display_name}</td>
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
      </div>
    </main>
  )
}
