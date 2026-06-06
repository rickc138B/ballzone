'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type RosterPlayer = {
  id: string; name: string; photo_url: string | null; nationality: string | null
  pts: number; reb: number; ast: number; stl: number; blk: number
  games_played: number; fg_pct: number; three_pct: number
}

type GameSummary = {
  id: string; game_date: string
  opponent_name: string; opponent_abbr: string
  team_score: number; opp_score: number; won: boolean
}

type TeamData = {
  team: { id: string; name: string; abbreviation: string; logo_url: string | null }
  record: { w: number; l: number; gp: number; pts_for: number; pts_against: number }
  roster: RosterPlayer[]
  games: GameSummary[]
}

function fmtPct(val: number) {
  return val ? (val * 100).toFixed(1) + '%' : '-'
}

export default function ProTeamPage() {
  const { slug, teamId } = useParams() as { slug: string; teamId: string }
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
        body: JSON.stringify({ target_id: teamId, target_type: 'team' }),
      })
      const d = await res.json()
      setFollowing(d.following)
    } finally { setFollowLoading(false) }
  }
  const [data, setData] = useState<TeamData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'roster' | 'games'>('roster')

  useEffect(() => {
    fetch(`/api/pro/${slug}/team/${teamId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [slug, teamId])

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('bz_profile_token') : null
    if (!token) return
    fetch(`/api/follows?target_id=${teamId}&target_type=team`, { headers: { 'x-profile-token': token } })
      .then(r => r.json()).then(d => setFollowing(d.following ?? false))
  }, [teamId])

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

  const { team, record, roster, games } = data

  return (
    <main className="min-h-dvh flex flex-col max-w-lg mx-auto px-5 pb-16">
      <div className="pt-6 mb-6">
        <Link href={`/pro/${slug}`} className="text-white/30 text-sm flex items-center gap-1.5 mb-6">
          ← Back to {slug.toUpperCase()}
        </Link>

        {/* Team header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/20 border border-orange-500/30
                          flex items-center justify-center text-3xl flex-shrink-0">
            🏀
          </div>
          <div>
            <h1 className="text-2xl font-black text-white leading-tight">{team.name}</h1>
            <p className="text-orange-400 text-sm font-medium mt-0.5">{team.abbreviation}</p>
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

        {/* Record */}
        <div className="card p-4 mb-5">
          <div className="grid grid-cols-5 gap-2 text-center">
            <div>
              <div className="text-2xl font-black text-green-400">{record.w}</div>
              <div className="text-white/30 text-xs mt-0.5">W</div>
            </div>
            <div>
              <div className="text-2xl font-black text-red-400">{record.l}</div>
              <div className="text-white/30 text-xs mt-0.5">L</div>
            </div>
            <div>
              <div className="text-2xl font-black text-white">{record.gp}</div>
              <div className="text-white/30 text-xs mt-0.5">GP</div>
            </div>
            <div>
              <div className="text-xl font-black text-white">{record.gp ? (record.pts_for / record.gp).toFixed(1) : '-'}</div>
              <div className="text-white/30 text-xs mt-0.5">PPG</div>
            </div>
            <div>
              <div className="text-xl font-black text-white/50">{record.gp ? (record.pts_against / record.gp).toFixed(1) : '-'}</div>
              <div className="text-white/30 text-xs mt-0.5">OPP</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {(['roster', 'games'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all
                ${tab === t ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/50'}`}>
              {t === 'roster' ? '👤 Roster' : '🏀 Games'}
            </button>
          ))}
        </div>

        {/* Roster */}
        {tab === 'roster' && (
          <div className="card overflow-hidden">
            {roster.length === 0 && (
              <p className="text-white/20 text-sm text-center py-6">No roster data</p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/30 uppercase tracking-wider border-b border-white/10">
                    <th className="text-left px-3 py-2">Player</th>
                    <th className="text-center px-2 py-2">GP</th>
                    <th className="text-center px-2 py-2 text-orange-400">PTS</th>
                    <th className="text-center px-2 py-2">REB</th>
                    <th className="text-center px-2 py-2">AST</th>
                    <th className="text-center px-2 py-2">FG%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {roster.map(p => (
                    <tr key={p.id}>
                      <td className="px-3 py-2.5">
                        <Link href={`/pro/${slug}/player/${p.id}`}
                          className="font-semibold text-white active:text-orange-400 whitespace-nowrap">
                          {p.name}
                        </Link>
                        {p.nationality && (
                          <p className="text-white/20 text-xs">{p.nationality}</p>
                        )}
                      </td>
                      <td className="text-center px-2 py-2.5 text-white/40">{p.games_played}</td>
                      <td className="text-center px-2 py-2.5 text-orange-400 font-black">{p.pts}</td>
                      <td className="text-center px-2 py-2.5 text-white/70">{p.reb}</td>
                      <td className="text-center px-2 py-2.5 text-white/70">{p.ast}</td>
                      <td className="text-center px-2 py-2.5 text-white/40">{fmtPct(p.fg_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Games */}
        {tab === 'games' && (
          <div className="space-y-2">
            {games.length === 0 && (
              <p className="text-white/20 text-sm text-center py-8">No games yet</p>
            )}
            {games.map(g => (
              <Link key={g.id} href={`/pro/${slug}/game/${g.id}`}>
                <div className="card p-3 border-white/5 active:bg-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-white/40 text-xs">
                      {new Date(g.game_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-white text-sm font-semibold">vs {g.opponent_name}</p>
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
        )}
      </div>
    </main>
  )
}
