'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type Player = {
  id: string
  display_name: string
  jersey_number: string | null
  photo_url: string | null
  claimed_by: string | null
}

type Game = {
  id: string
  round_label: string | null
  played_at: string | null
  home_score: number | null
  away_score: number | null
  home_team: { id: string; name: string } | null
  away_team: { id: string; name: string } | null
}

type TeamData = {
  team: {
    id: string; name: string; logo_url: string | null
    description: string | null; home_court: string | null
    instagram_url: string | null; twitter_url: string | null
    founded_year: string | null; primary_color: string | null
  }
  players: Player[]
  games: Game[]
  record: { wins: number; losses: number; ptsFor: number; ptsAgainst: number }
  playerStats: Record<string, { pts: number; reb: number; ast: number; gp: number }>
}

export default function TeamPage() {
  const { id: leagueId, teamId } = useParams() as { id: string; teamId: string }
  const [data, setData] = useState<TeamData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'roster' | 'games' | 'stats'>('roster')

  useEffect(() => {
    fetch(`/api/leagues/${leagueId}/team/${teamId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [leagueId, teamId])

  if (loading) return (
    <main className="min-h-dvh flex items-center justify-center">
      <div className="text-white/40 text-lg">Loading...</div>
    </main>
  )

  if (!data?.team) return (
    <main className="min-h-dvh flex items-center justify-center">
      <div className="text-white/40">Team not found</div>
    </main>
  )

  const { team, players, games, record, playerStats } = data
  const color = team.primary_color ?? '#f97316'

  return (
    <main className="min-h-dvh flex flex-col max-w-lg mx-auto pb-16">
      {/* Hero */}
      <div className="relative w-full pt-16 pb-8 px-5"
        style={{ background: `linear-gradient(135deg, ${color}22 0%, #0f0f1a 60%)` }}>
        <Link href={`/league/${leagueId}`} className="text-white/40 text-sm mb-6 block">← League</Link>

        <div className="flex items-center gap-4 mb-4">
          {team.logo_url ? (
            <img src={team.logo_url} alt={team.name}
              className="w-20 h-20 rounded-2xl object-cover border-2 border-white/10" />
          ) : (
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
              style={{ background: `${color}33`, border: `2px solid ${color}44` }}>
              🏀
            </div>
          )}
          <div>
            <h1 className="text-2xl font-black text-white">{team.name}</h1>
            {team.founded_year && <p className="text-white/30 text-xs">Est. {team.founded_year}</p>}
            {team.home_court && <p className="text-white/40 text-xs mt-0.5">📍 {team.home_court}</p>}
          </div>
        </div>

        {/* Record */}
        <div className="flex gap-3 mb-4">
          <div className="card px-4 py-2 flex flex-col items-center">
            <span className="text-green-400 font-black text-xl">{record.wins}</span>
            <span className="text-white/30 text-xs">W</span>
          </div>
          <div className="card px-4 py-2 flex flex-col items-center">
            <span className="text-red-400 font-black text-xl">{record.losses}</span>
            <span className="text-white/30 text-xs">L</span>
          </div>
          <div className="card px-4 py-2 flex flex-col items-center">
            <span className="text-white font-black text-xl">{record.wins + record.losses}</span>
            <span className="text-white/30 text-xs">GP</span>
          </div>
          <div className="card px-4 py-2 flex flex-col items-center">
            <span className="text-white/70 font-black text-xl">
              {record.ptsFor - record.ptsAgainst > 0 ? '+' : ''}{record.ptsFor - record.ptsAgainst}
            </span>
            <span className="text-white/30 text-xs">+/-</span>
          </div>
        </div>

        {team.description && (
          <p className="text-white/40 text-sm italic mb-3">{team.description}</p>
        )}

        {/* Social links */}
        <div className="flex gap-2">
          {team.instagram_url && (
            <a href={team.instagram_url} target="_blank" rel="noopener noreferrer"
              className="text-white/30 text-xs border border-white/10 rounded-lg px-3 py-1.5 active:bg-white/5">
              📸 Instagram
            </a>
          )}
          {team.twitter_url && (
            <a href={team.twitter_url} target="_blank" rel="noopener noreferrer"
              className="text-white/30 text-xs border border-white/10 rounded-lg px-3 py-1.5 active:bg-white/5">
              🐦 Twitter
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-5 mb-5">
        {(['roster', 'stats', 'games'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all
              ${tab === t ? 'text-white' : 'bg-white/10 text-white/50'}`}
            style={tab === t ? { backgroundColor: color } : {}}>
            {t === 'roster' ? '👥 Roster' : t === 'stats' ? '📊 Stats' : '🏀 Games'}
          </button>
        ))}
      </div>

      <div className="px-5">
        {/* Roster */}
        {tab === 'roster' && (
          <div className="space-y-2">
            {players.length === 0 && (
              <p className="text-white/20 text-sm text-center py-8">No players yet</p>
            )}
            {players.map(p => (
              <Link key={p.id} href={`/league/${leagueId}/player/${p.id}`}>
                <div className="card p-3 flex items-center gap-3 active:bg-white/5">
                  {p.photo_url ? (
                    <img src={p.photo_url} alt={p.display_name}
                      className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/40 text-sm font-bold">
                      {p.jersey_number ?? p.display_name[0]}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-white text-sm font-semibold">{p.display_name}</p>
                    {p.jersey_number && <p className="text-white/30 text-xs">#{p.jersey_number}</p>}
                  </div>
                  {p.claimed_by && <span className="text-green-400 text-xs">✓ Claimed</span>}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Stats */}
        {tab === 'stats' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/30 uppercase tracking-wider border-b border-white/10">
                    <th className="text-left px-3 py-2">Player</th>
                    <th className="text-center px-2 py-2">GP</th>
                    <th className="text-center px-2 py-2">PTS</th>
                    <th className="text-center px-2 py-2">REB</th>
                    <th className="text-center px-2 py-2">AST</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {players.map(p => {
                    const s = playerStats[p.id]
                    if (!s || s.gp === 0) return null
                    return (
                      <tr key={p.id} className="text-white/70">
                        <td className="px-3 py-2.5">
                          <Link href={`/league/${leagueId}/player/${p.id}`}
                            className="font-semibold text-white">{p.display_name}</Link>
                        </td>
                        <td className="text-center px-2 py-2.5 text-white/40">{s.gp}</td>
                        <td className="text-center px-2 py-2.5 text-orange-400 font-bold">
                          {(s.pts / s.gp).toFixed(1)}
                        </td>
                        <td className="text-center px-2 py-2.5">{(s.reb / s.gp).toFixed(1)}</td>
                        <td className="text-center px-2 py-2.5">{(s.ast / s.gp).toFixed(1)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Games */}
        {tab === 'games' && (
          <div className="space-y-3">
            {games.length === 0 && (
              <p className="text-white/20 text-sm text-center py-8">No games yet</p>
            )}
            {games.map(g => {
              const isHome = g.home_team?.id === teamId
              const teamScore = isHome ? g.home_score : g.away_score
              const oppScore = isHome ? g.away_score : g.home_score
              const opp = isHome ? g.away_team : g.home_team
              const isScheduled = teamScore === null
              const won = !isScheduled && (teamScore ?? 0) > (oppScore ?? 0)
              return (
                <Link key={g.id} href={`/league/${leagueId}/game/${g.id}`}>
                  <div className="card p-3 flex items-center justify-between active:bg-white/5">
                    <div>
                      <p className="text-white/30 text-xs mb-0.5">{g.round_label ?? ''}</p>
                      <p className="text-white text-sm font-semibold">vs {opp?.name ?? '—'}</p>
                      {g.played_at && (
                        <p className="text-white/20 text-xs">
                          {new Date(g.played_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </p>
                      )}
                    </div>
                    {isScheduled ? (
                      <span className="text-orange-400 text-xs font-bold">TBD</span>
                    ) : (
                      <div className="text-right">
                        <p className={`font-black text-lg tabular-nums ${won ? 'text-orange-400' : 'text-white/30'}`}>
                          {teamScore}–{oppScore}
                        </p>
                        <p className={`text-xs font-bold ${won ? 'text-green-400' : 'text-red-400'}`}>
                          {won ? 'W' : 'L'}
                        </p>
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
