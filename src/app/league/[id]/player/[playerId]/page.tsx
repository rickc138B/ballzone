'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getFingerprint } from '@/lib/fingerprint'

type Averages = {
  gp: number; ppg: number; rpg: number; apg: number
  spg: number; bpg: number; tpg: number
  fg_pct: number; three_pct: number; ft_pct: number
}
type GameLog = {
  game_id: string; round_label: string | null; played_at: string | null
  home_team: string; away_team: string; home_score: number; away_score: number
  pts: number; reb: number; ast: number; stl: number; blk: number; tov: number
  fgm: number; fga: number; three_pm: number; three_pa: number; ftm: number; fta: number
}
type CareerHigh = { pts: number; reb: number; ast: number; game: GameLog }
type ProfileData = {
  player: { id: string; display_name: string; team_name: string; claimed_by: string | null }
  averages: Averages | null
  career_high: CareerHigh | null
  game_log: GameLog[]
}

export default function PlayerProfilePage() {
  const { id: leagueId, playerId } = useParams() as { id: string; playerId: string }
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fingerprint, setFingerprint] = useState('')
  const [isMine, setIsMine] = useState(false)

  // Claim state
  const [showClaim, setShowClaim] = useState(false)
  const [claimCode, setClaimCode] = useState('')
  const [claiming, setClaiming] = useState(false)
  const [claimError, setClaimError] = useState('')
  const [claimSuccess, setClaimSuccess] = useState(false)

  useEffect(() => {
    fetch(`/api/leagues/${leagueId}/player/${playerId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })

    getFingerprint().then(fp => {
      setFingerprint(fp)
      const claimed = localStorage.getItem(`claimed:${playerId}`)
      if (claimed === fp) setIsMine(true)
    })
  }, [leagueId, playerId])

  useEffect(() => {
    if (data && fingerprint && data.player.claimed_by === fingerprint) {
      setIsMine(true)
      localStorage.setItem(`claimed:${playerId}`, fingerprint)
    }
  }, [data, fingerprint, playerId])

  async function submitClaim() {
    if (!claimCode.trim()) return
    setClaiming(true)
    setClaimError('')
    const res = await fetch(`/api/leagues/${leagueId}/player/${playerId}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim_code: claimCode.trim(), fingerprint }),
    })
    const result = await res.json()
    if (!res.ok) { setClaimError(result.error); setClaiming(false); return }
    setClaimSuccess(true)
    setIsMine(true)
    localStorage.setItem(`claimed:${playerId}`, fingerprint)
    setClaiming(false)
    setShowClaim(false)
  }

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

  const { player, averages, career_high, game_log } = data
  const isClaimed = !!player.claimed_by
  const claimedByOther = isClaimed && !isMine

  return (
    <main className="min-h-dvh flex flex-col p-5 max-w-lg mx-auto pb-10">
      <div className="pt-4 mb-6">
        <Link href={`/league/${leagueId}`} className="text-white/40 text-sm mb-4 block">← League</Link>

        {/* Player header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/20 border border-orange-500/30
                            flex items-center justify-center text-2xl">
              🏀
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white">{player.display_name}</h1>
                {isMine && <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">✓ You</span>}
                {claimedByOther && <span className="text-xs bg-white/10 text-white/30 px-2 py-0.5 rounded-full">Claimed</span>}
              </div>
              <p className="text-orange-400 text-sm font-medium">{player.team_name}</p>
            </div>
          </div>

          {!isClaimed && !claimSuccess && (
            <button
              onClick={() => setShowClaim(!showClaim)}
              className="text-xs px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 text-white/50 active:bg-white/20"
            >
              Claim
            </button>
          )}
        </div>

        {/* Claim panel */}
        {showClaim && !isMine && (
          <div className="card p-4 border-orange-500/20 mb-4">
            <p className="text-orange-400 text-xs uppercase tracking-wider font-semibold mb-1">Claim this profile</p>
            <p className="text-white/40 text-xs mb-3">Enter the code your league organizer gave you</p>
            <div className="flex gap-2">
              <input
                value={claimCode}
                onChange={e => setClaimCode(e.target.value.toUpperCase())}
                placeholder="e.g. A1B2C3D4"
                maxLength={8}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2
                           text-white text-sm font-mono uppercase tracking-widest placeholder:text-white/20
                           focus:outline-none focus:border-orange-500/50"
              />
              <button
                onClick={submitClaim}
                disabled={!claimCode.trim() || claiming}
                className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold
                           disabled:opacity-30 active:scale-95 transition-transform"
              >
                {claiming ? '...' : '→'}
              </button>
            </div>
            {claimError && <p className="text-red-400 text-xs mt-2">{claimError}</p>}
          </div>
        )}

        {claimSuccess && (
          <div className="card p-3 border-green-500/20 mb-4">
            <p className="text-green-400 text-sm">✓ Profile claimed — this is now yours on this device</p>
          </div>
        )}

        {!averages ? (
          <p className="text-white/30 text-sm text-center py-8">No games played yet</p>
        ) : (
          <>
            {/* Career high */}
            {career_high && (
              <div className="card p-4 border-orange-500/20 mb-4">
                <p className="text-orange-400 text-xs uppercase tracking-wider font-semibold mb-2">🔥 Career High</p>
                <div className="flex items-end gap-3">
                  <div>
                    <span className="text-4xl font-black text-white">{career_high.pts}</span>
                    <span className="text-white/40 text-sm ml-1">PTS</span>
                  </div>
                  <div className="text-white/50 text-sm pb-1">
                    {career_high.reb} REB · {career_high.ast} AST
                  </div>
                </div>
                {career_high.game?.round_label && (
                  <p className="text-white/30 text-xs mt-1">
                    {career_high.game.round_label}
                    {career_high.game.played_at
                      ? ` · ${new Date(career_high.game.played_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                      : ''}
                  </p>
                )}
              </div>
            )}

            {/* Averages */}
            <div className="card p-4 mb-4">
              <p className="text-white/30 text-xs uppercase tracking-wider mb-3">
                Season Averages · {averages.gp} GP
              </p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'PPG', value: averages.ppg },
                  { label: 'RPG', value: averages.rpg },
                  { label: 'APG', value: averages.apg },
                  { label: 'SPG', value: averages.spg },
                  { label: 'BPG', value: averages.bpg },
                  { label: 'TPG', value: averages.tpg },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <div className="text-xl font-black text-white tabular-nums">{value}</div>
                    <div className="text-white/30 text-xs mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/10">
                {[
                  { label: 'FG%', value: `${averages.fg_pct}%` },
                  { label: '3P%', value: `${averages.three_pct}%` },
                  { label: 'FT%', value: `${averages.ft_pct}%` },
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
                const isCareerHigh = career_high && g.pts === career_high.pts && i === 0
                return (
                  <Link key={g.game_id} href={`/league/${leagueId}/game/${g.game_id}`}>
                    <div className="card p-3 border-white/5 active:bg-white/5 transition-colors">
                      <div className="flex items-start justify-between mb-1.5">
                        <div>
                          <span className="text-white/40 text-xs">{g.round_label ?? 'Game'}</span>
                          {isCareerHigh && <span className="ml-2 text-orange-400 text-xs">🔥 Career High</span>}
                        </div>
                        {g.played_at && (
                          <span className="text-white/20 text-xs">
                            {new Date(g.played_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-white/40 text-xs">
                          {g.home_team} {g.home_score} – {g.away_score} {g.away_team}
                        </div>
                        <div className="flex gap-3 text-xs tabular-nums">
                          <span className="text-orange-400 font-bold">{g.pts}pts</span>
                          <span className="text-white/40">{g.reb}reb</span>
                          <span className="text-white/40">{g.ast}ast</span>
                          {g.stl > 0 && <span className="text-white/40">{g.stl}stl</span>}
                          {g.blk > 0 && <span className="text-white/40">{g.blk}blk</span>}
                        </div>
                      </div>
                      <div className="text-white/20 text-xs mt-1">
                        {g.fgm}/{g.fga} FG · {g.three_pm}/{g.three_pa} 3P · {g.ftm}/{g.fta} FT
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
