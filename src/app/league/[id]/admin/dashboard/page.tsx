'use client'

import { useEffect, useState, useCallback } from 'react'
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
  status: string | null
  location_name: string | null
  home_team: Team | null
  away_team: Team | null
}

export default function AdminDashboardPage() {
  const { id: leagueId } = useParams() as { id: string }
  const [pin, setPin] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [pinError, setPinError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [games, setGames] = useState<Game[]>([])
  const [leagueTitle, setLeagueTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchGames = useCallback(async () => {
    const res = await fetch(`/api/leagues/${leagueId}`)
    const data = await res.json()
    if (data.games) {
      setGames(data.games)
      setLeagueTitle(data.league?.title ?? '')
      setLastRefresh(new Date())
    }
    setLoading(false)
  }, [leagueId])

  useEffect(() => {
    fetchGames()
  }, [fetchGames])

  // Poll every 15s for live game score updates
  useEffect(() => {
    const liveGames = games.filter(g => g.status === 'live')
    if (liveGames.length === 0) return
    const interval = setInterval(fetchGames, 15000)
    return () => clearInterval(interval)
  }, [games, fetchGames])

  async function verifyPin() {
    setVerifying(true); setPinError('')
    const res = await fetch(`/api/leagues/${leagueId}/verify-pin`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
    const data = await res.json()
    if (!data.valid) { setPinError('Invalid PIN'); setVerifying(false); return }
    setUnlocked(true); setVerifying(false)
  }

  if (!unlocked) return (
    <main className="min-h-dvh flex flex-col p-5 max-w-lg mx-auto">
      <div className="pt-4 mb-6">
        <Link href={`/league/${leagueId}/admin`} className="text-white/40 text-sm mb-4 block">← Admin</Link>
        <div className="text-3xl mb-2">📊</div>
        <h1 className="text-2xl font-black text-white">Game Dashboard</h1>
        <p className="text-white/40 text-sm mt-1">Enter PIN to view all games</p>
      </div>
      <div className="space-y-3">
        <input type="password" value={pin} onChange={e => setPin(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && verifyPin()}
          placeholder="Admin PIN"
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500" />
        {pinError && <p className="text-red-400 text-sm">{pinError}</p>}
        <button onClick={verifyPin} disabled={!pin.trim() || verifying}
          className="w-full py-3 rounded-2xl font-bold bg-orange-500 text-white disabled:opacity-40">
          {verifying ? 'Checking...' : 'Unlock →'}
        </button>
      </div>
    </main>
  )

  const liveGames = games.filter(g => g.status === 'live')
  const scheduledGames = games.filter(g => g.status === 'scheduled')
  const completedGames = games.filter(g => g.status === 'complete')

  const GameCard = ({ g, highlight }: { g: Game; highlight?: boolean }) => {
    const isLive = g.status === 'live'
    const isScheduled = g.status === 'scheduled'
    const homeWon = !isScheduled && (g.home_score ?? 0) > (g.away_score ?? 0)
    return (
      <div className={`card p-4 border ${highlight ? 'border-green-500/30 bg-green-500/5' : 'border-white/10'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isLive && (
              <span className="flex items-center gap-1 text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                LIVE
              </span>
            )}
            {isScheduled && (
              <span className="text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full">
                UPCOMING
              </span>
            )}
            <span className="text-white/30 text-xs">{g.round_label ?? `Game ${g.sequence_number}`}</span>
          </div>
          {g.played_at && (
            <span className="text-white/20 text-xs">
              {new Date(g.played_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>

        {/* Score row */}
        <div className="space-y-2 mb-3">
          {[
            { team: g.home_team, score: g.home_score, won: homeWon && !isScheduled },
            { team: g.away_team, score: g.away_score, won: !homeWon && !isScheduled && g.away_score !== null },
          ].map(({ team, score, won }) => (
            <div key={team?.id} className="flex items-center justify-between">
              <span className={`text-sm font-semibold ${won ? 'text-white' : 'text-white/50'}`}>
                {team?.name ?? '—'}
              </span>
              <span className={`font-black text-xl tabular-nums ${
                isLive ? (won ? 'text-green-400' : 'text-orange-400')
                : isScheduled ? 'text-white/20'
                : won ? 'text-orange-400' : 'text-white/30'
              }`}>
                {isScheduled ? '—' : (score ?? '0')}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {isLive && (
            <Link href={`/league/${leagueId}/game/${g.id}/live`}
              className="flex-1 py-2 rounded-xl bg-green-500 text-white text-xs font-bold text-center active:opacity-70">
              🔴 Open Live Scorer
            </Link>
          )}
          {isScheduled && (
            <Link href={`/league/${leagueId}/game/${g.id}/live`}
              className="flex-1 py-2 rounded-xl bg-orange-500/20 text-orange-400 text-xs font-bold text-center border border-orange-500/30 active:opacity-70">
              ▶ Start Scoring
            </Link>
          )}
          <Link href={`/league/${leagueId}/game/${g.id}`}
            className="flex-1 py-2 rounded-xl bg-white/10 text-white/50 text-xs font-semibold text-center active:opacity-70">
            View Game →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-dvh flex flex-col p-5 max-w-lg mx-auto pb-10">
      <div className="pt-4 mb-6">
        <Link href={`/league/${leagueId}/admin`} className="text-white/40 text-sm mb-4 block">← Admin</Link>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-orange-400 text-xs uppercase tracking-wider font-semibold mb-1">📊 Dashboard</p>
            <h1 className="text-2xl font-black text-white">{leagueTitle}</h1>
          </div>
          <button onClick={fetchGames}
            className="text-white/30 text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl active:bg-white/10">
            ↻ Refresh
          </button>
        </div>
        {lastRefresh && (
          <p className="text-white/20 text-xs mt-1">
            Updated {lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            {liveGames.length > 0 && ' · auto-refreshing'}
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-white/40">Loading...</div>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Live games */}
          {liveGames.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <p className="text-green-400 text-xs uppercase tracking-wider font-bold">Live Now ({liveGames.length})</p>
              </div>
              <div className="space-y-3">
                {liveGames.map(g => <GameCard key={g.id} g={g} highlight />)}
              </div>
            </div>
          )}

          {/* Scheduled */}
          {scheduledGames.length > 0 && (
            <div>
              <p className="text-orange-400 text-xs uppercase tracking-wider font-bold mb-3">Upcoming ({scheduledGames.length})</p>
              <div className="space-y-3">
                {scheduledGames.map(g => <GameCard key={g.id} g={g} />)}
              </div>
            </div>
          )}

          {/* Completed */}
          {completedGames.length > 0 && (
            <div>
              <p className="text-white/30 text-xs uppercase tracking-wider font-bold mb-3">Completed ({completedGames.length})</p>
              <div className="space-y-3">
                {completedGames.map(g => <GameCard key={g.id} g={g} />)}
              </div>
            </div>
          )}

          {games.length === 0 && (
            <div className="text-center py-20">
              <p className="text-white/20 text-sm">No games yet</p>
              <Link href={`/league/${leagueId}/admin`}
                className="mt-4 inline-block px-4 py-2 rounded-xl bg-white/10 text-white/50 text-sm">
                ← Schedule a game
              </Link>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
