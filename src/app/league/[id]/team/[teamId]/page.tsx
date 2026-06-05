'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type Player = {
  id: string
  display_name: string
  photo_url: string | null
  is_claimed: boolean
}

type TeamData = {
  team: { id: string; name: string }
  players: Player[]
  record: { w: number; l: number; gp: number; pts_for: number; pts_against: number }
  games: {
    id: string
    round_label: string | null
    played_at: string | null
    opponent: string
    team_score: number
    opp_score: number
    won: boolean
  }[]
}

export default function TeamPage() {
  const { id: leagueId, teamId } = useParams() as { id: string; teamId: string }
  const [data, setData] = useState<TeamData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/leagues/${leagueId}/team/${teamId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [leagueId, teamId])

  if (loading) return (
    <main className="min-h-dvh flex items-center justify-center">
      <div className="text-white/40">Loading...</div>
    </main>
  )

  if (!data?.team) return (
    <main className="min-h-dvh flex items-center justify-center">
      <div className="text-white/40">Team not found</div>
    </main>
  )

  const { team, players, record, games } = data

  return (
    <main className="min-h-dvh flex flex-col p-5 max-w-lg mx-auto pb-10">
      <div className="pt-4 mb-6">
        <Link href={`/league/${leagueId}`} className="text-white/40 text-sm mb-4 block">← League</Link>
        <div className="flex items-center gap-4 mb-2">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/20 border border-orange-500/30
                          flex items-center justify-center text-2xl flex-shrink-0">
            🏀
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">{team.name}</h1>
            <p className="text-white/40 text-sm">{record.gp} games played</p>
          </div>
        </div>
      </div>

      {/* Record */}
      <div className="card p-4 mb-4">
        <div className="grid grid-cols-4 gap-3 text-center">
          <div>
            <div className="text-2xl font-black text-green-400">{record.w}</div>
            <div className="text-white/30 text-xs mt-0.5">W</div>
          </div>
          <div>
            <div className="text-2xl font-black text-red-400">{record.l}</div>
            <div className="text-white/30 text-xs mt-0.5">L</div>
          </div>
          <div>
            <div className="text-2xl font-black text-white">{record.pts_for}</div>
            <div className="text-white/30 text-xs mt-0.5">PF</div>
          </div>
          <div>
            <div className="text-2xl font-black text-white/50">{record.pts_against}</div>
            <div className="text-white/30 text-xs mt-0.5">PA</div>
          </div>
        </div>
      </div>

      {/* Roster */}
      <p className="text-white/30 text-xs uppercase tracking-wider mb-3">Roster</p>
      <div className="card overflow-hidden mb-5">
        {players.length === 0 && (
          <p className="text-white/20 text-sm text-center py-6">No players yet</p>
        )}
        {players.map((p, i) => (
          <Link key={p.id} href={`/league/${leagueId}/player/${p.id}`}>
            <div className={`flex items-center gap-3 px-4 py-3 active:bg-white/5
              ${i < players.length - 1 ? 'border-b border-white/5' : ''}`}>
              <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20
                              flex items-center justify-center overflow-hidden flex-shrink-0">
                {p.photo_url
                  ? <img src={p.photo_url} alt={p.display_name} className="w-full h-full object-cover" />
                  : <span className="text-sm">🏀</span>}
              </div>
              <span className="text-white text-sm font-semibold flex-1">{p.display_name}</span>
              {p.is_claimed && (
                <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded-full">✓</span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Game log */}
      {games.length > 0 && (
        <>
          <p className="text-white/30 text-xs uppercase tracking-wider mb-3">Games</p>
          <div className="space-y-2">
            {games.map(g => (
              <Link key={g.id} href={`/league/${leagueId}/game/${g.id}`}>
                <div className="card p-3 border-white/5 active:bg-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-white/40 text-xs">{g.round_label ?? 'Game'}</p>
                    <p className="text-white text-sm font-semibold">vs {g.opponent}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-black tabular-nums ${g.won ? 'text-orange-400' : 'text-white/30'}`}>
                      {g.team_score}–{g.opp_score}
                    </p>
                    <p className={`text-xs font-bold ${g.won ? 'text-green-400' : 'text-red-400'}`}>
                      {g.won ? 'W' : 'L'}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
