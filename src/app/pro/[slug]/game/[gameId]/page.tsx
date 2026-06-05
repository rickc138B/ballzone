'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type PlayerGameStat = {
  id: string; name: string
  pts: number; reb: number; ast: number; stl: number; blk: number; tov: number
  fgm: number; fga: number; three_pm: number; three_pa: number; ftm: number; fta: number
  minutes: string
}

type GameDetail = {
  id: string
  game_date: string
  status: string
  home_team: { id: string; name: string; abbreviation: string }
  away_team: { id: string; name: string; abbreviation: string }
  home_score: number
  away_score: number
  home_players: PlayerGameStat[]
  away_players: PlayerGameStat[]
}

function fmtPct(made: number, att: number) {
  if (!att) return '-'
  return ((made / att) * 100).toFixed(0) + '%'
}

function BoxScoreTable({ players, teamName, score, won, slug }: {
  players: PlayerGameStat[]
  teamName: string
  score: number
  won: boolean
  slug: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          {won && <span className="text-yellow-400 text-sm">👑</span>}
          <span className={`font-black text-base ${won ? 'text-white' : 'text-white/40'}`}>
            {teamName}
          </span>
        </div>
        <span className={`text-3xl font-black tabular-nums ${won ? 'text-orange-400' : 'text-white/25'}`}>
          {score}
        </span>
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
              <tr key={p.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <Link
                    href={`/pro/${slug}/player/${p.id}`}
                    className="font-semibold text-white hover:text-orange-400 transition-colors"
                  >
                    {p.name}
                  </Link>
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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/pro/${slug}/games/${gameId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setGame(d.game)
        setLoading(false)
      })
      .catch(() => { setError('Failed to load'); setLoading(false) })
  }, [slug, gameId])

  if (loading) return (
    <main className="min-h-dvh flex items-center justify-center">
      <div className="text-white/40 text-lg">Loading...</div>
    </main>
  )

  if (error || !game) return (
    <main className="min-h-dvh flex items-center justify-center">
      <div className="text-white/40">{error ?? 'Game not found'}</div>
    </main>
  )

  const homeWon = game.home_score > game.away_score
  const dateStr = new Date(game.game_date).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  // Team totals
  const totals = (players: PlayerGameStat[]) => ({
    pts: players.reduce((s, p) => s + p.pts, 0),
    reb: players.reduce((s, p) => s + p.reb, 0),
    ast: players.reduce((s, p) => s + p.ast, 0),
    fgm: players.reduce((s, p) => s + p.fgm, 0),
    fga: players.reduce((s, p) => s + p.fga, 0),
    three_pm: players.reduce((s, p) => s + p.three_pm, 0),
    three_pa: players.reduce((s, p) => s + p.three_pa, 0),
  })

  const homeT = totals(game.home_players)
  const awayT = totals(game.away_players)

  return (
    <main className="min-h-dvh flex flex-col max-w-2xl mx-auto pb-16">
      {/* Back nav */}
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
            {/* Away */}
            <div className={`flex-1 text-center ${!homeWon ? 'opacity-100' : 'opacity-40'}`}>
              <p className="text-white font-black text-base leading-tight">{game.away_team.name}</p>
              <p className="text-white/30 text-xs mt-0.5">{game.away_team.abbreviation}</p>
              <p className={`text-5xl font-black tabular-nums mt-3 ${!homeWon ? 'text-orange-400' : 'text-white/20'}`}>
                {game.away_score}
              </p>
            </div>

            {/* Divider */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-white/10 text-2xl font-black">—</span>
              <span className="text-white/20 text-xs uppercase tracking-widest">Final</span>
              <span className="text-white/10 text-2xl font-black">—</span>
            </div>

            {/* Home */}
            <div className={`flex-1 text-center ${homeWon ? 'opacity-100' : 'opacity-40'}`}>
              <p className="text-white font-black text-base leading-tight">{game.home_team.name}</p>
              <p className="text-white/30 text-xs mt-0.5">{game.home_team.abbreviation} · HME</p>
              <p className={`text-5xl font-black tabular-nums mt-3 ${homeWon ? 'text-orange-400' : 'text-white/20'}`}>
                {game.home_score}
              </p>
            </div>
          </div>

          {/* Team stat comparison bar */}
          <div className="mt-5 pt-4 border-t border-white/10 space-y-2">
            {[
              { label: 'FG%', away: fmtPct(awayT.fgm, awayT.fga), home: fmtPct(homeT.fgm, homeT.fga), awayVal: awayT.fga ? awayT.fgm/awayT.fga : 0, homeVal: homeT.fga ? homeT.fgm/homeT.fga : 0 },
              { label: '3P%', away: fmtPct(awayT.three_pm, awayT.three_pa), home: fmtPct(homeT.three_pm, homeT.three_pa), awayVal: awayT.three_pa ? awayT.three_pm/awayT.three_pa : 0, homeVal: homeT.three_pa ? homeT.three_pm/homeT.three_pa : 0 },
              { label: 'REB', away: awayT.reb, home: homeT.reb, awayVal: awayT.reb, homeVal: homeT.reb },
              { label: 'AST', away: awayT.ast, home: homeT.ast, awayVal: awayT.ast, homeVal: homeT.ast },
            ].map(row => {
              const total = (row.awayVal as number) + (row.homeVal as number)
              const awayPct = total ? ((row.awayVal as number) / total) * 100 : 50
              return (
                <div key={row.label} className="flex items-center gap-2 text-xs">
                  <span className={`w-10 text-right tabular-nums font-bold ${!homeWon ? 'text-orange-400' : 'text-white/50'}`}>{row.away}</span>
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden flex">
                    <div className="h-full bg-orange-500/60 rounded-full transition-all" style={{ width: `${awayPct}%` }} />
                  </div>
                  <span className={`w-10 tabular-nums font-bold ${homeWon ? 'text-orange-400' : 'text-white/50'}`}>{row.home}</span>
                  <span className="w-8 text-center text-white/20">{row.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Box scores */}
      <div className="px-4 space-y-4">
        <h2 className="text-white/30 text-xs uppercase tracking-widest font-semibold">Box Score</h2>
        <div className="card overflow-hidden">
          <BoxScoreTable
            players={game.away_players}
            teamName={game.away_team.name}
            score={game.away_score}
            won={!homeWon}
            slug={slug}
          />
        </div>
        <div className="card overflow-hidden">
          <BoxScoreTable
            players={game.home_players}
            teamName={game.home_team.name}
            score={game.home_score}
            won={homeWon}
            slug={slug}
          />
        </div>
      </div>
    </main>
  )
}
