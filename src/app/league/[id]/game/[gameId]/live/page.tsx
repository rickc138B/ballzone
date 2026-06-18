'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Team = { id: string; name: string }
type ScoreEvent = { id: string; team: 'home' | 'away'; pts: number }
type ServerScoreEvent = { id: string; team: 'home' | 'away'; pts: number; created_at: string; voided: boolean }
type LeaguePlayer = { id: string; display_name: string }
type GameInfo = {
  id: string; status: string; round_label: string | null
  home_team: Team; away_team: Team
  home_score: number | null; away_score: number | null
  recap_image_url: string | null
}
type StatTarget = { playerId: string; playerName: string; teamId: string; side: 'home' | 'away' }
type LiveStat = { pts: number; reb: number; ast: number; stl: number; blk: number; tov: number; foul: number }

const STAT_TYPES = [
  { type: 'foul',     label: '🟥 Foul' },
  { type: 'block',    label: '🛡 Block' },
  { type: 'steal',    label: '⚡ Steal' },
  { type: 'rebound',  label: '🏀 Rebound' },
  { type: 'assist',   label: '🎯 Assist' },
  { type: 'turnover', label: '↩ Turnover' },
]

export default function LiveScoringPage() {
  const { id: leagueId, gameId } = useParams() as { id: string; gameId: string }

  const [pin, setPin] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [pinError, setPinError] = useState('')
  const [verifying, setVerifying] = useState(false)

  const [game, setGame] = useState<GameInfo | null>(null)
  const [rosterHome, setRosterHome] = useState<LeaguePlayer[]>([])
  const [rosterAway, setRosterAway] = useState<LeaguePlayer[]>([])
  const [loading, setLoading] = useState(true)

  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)
  const [events, setEvents] = useState<ScoreEvent[]>([])
  const [tapping, setTapping] = useState<'home' | 'away' | null>(null)
  const [selectedScorer, setSelectedScorer] = useState<string | null>(null)
  const [lastScored, setLastScored] = useState<'home' | 'away' | null>(null)
  const [gameStatus, setGameStatus] = useState('scheduled')

  // Stat recording
  const [statTarget, setStatTarget] = useState<StatTarget | null>(null)
  const [liveStats, setLiveStats] = useState<Record<string, LiveStat>>({})
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Add player on the fly
  const [addingFor, setAddingFor] = useState<'home' | 'away' | null>(null)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [addingPlayer, setAddingPlayer] = useState(false)

  // Mid-game stats breakdown
  const [showBreakdown, setShowBreakdown] = useState(false)

  const [finishing, setFinishing] = useState(false)
  const [finished, setFinished] = useState(false)

  const [recapUrl, setRecapUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`/api/leagues/${leagueId}/game/${gameId}`).then(r => r.json()),
      fetch(`/api/leagues/${leagueId}/game/${gameId}/score-events`).then(r => r.json()),
    ]).then(([d, ev]) => {
      if (d.id) {
        setGame(d)
        const homeId = d.home_team?.id
        const awayId = d.away_team?.id
        if (homeId) fetch(`/api/leagues/${leagueId}/team/${homeId}`).then(r => r.json()).then(t => setRosterHome(t.players ?? []))
        if (awayId) fetch(`/api/leagues/${leagueId}/team/${awayId}`).then(r => r.json()).then(t => setRosterAway(t.players ?? []))
        setGameStatus(d.status ?? 'scheduled')
        setRecapUrl(d.recap_image_url ?? null)
        const serverEvents: ServerScoreEvent[] = (ev.events ?? []).filter((e: ServerScoreEvent) => !e.voided)
        if (serverEvents.length > 0) {
          const home = serverEvents.filter(e => e.team === 'home').reduce((s, e) => s + e.pts, 0)
          const away = serverEvents.filter(e => e.team === 'away').reduce((s, e) => s + e.pts, 0)
          setHomeScore(home)
          setAwayScore(away)
          setEvents(serverEvents.map(e => ({ id: e.id, team: e.team, pts: e.pts })))
        } else {
          setHomeScore(d.home_score ?? 0)
          setAwayScore(d.away_score ?? 0)
        }
      }
      setLoading(false)
    })
  }, [leagueId, gameId])

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2000)
  }

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

  async function startGame() {
    await fetch(`/api/leagues/${leagueId}/game/${gameId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, status: 'live' }),
    })
    setGameStatus('live')
  }

  async function score(side: 'home' | 'away', pts: 1 | 2 | 3, scorerName?: string) {
    if (side === 'home') setHomeScore(s => s + pts)
    else setAwayScore(s => s + pts)
    const tempId = `temp-${Math.random().toString(36).slice(2)}`
    setEvents(ev => [{ id: tempId, team: side, pts }, ...ev])
    setLastScored(side)
    setTapping(null)
    setTimeout(() => setLastScored(null), 500)

    // Optimistically increment pts in liveStats for the scorer
    if (scorerName) {
      const scorerPlayer = (side === 'home' ? rosterHome : rosterAway).find(p => p.display_name === scorerName)
      if (scorerPlayer) {
        setLiveStats(prev => {
          const cur = prev[scorerPlayer.id] ?? { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, foul: 0 }
          return { ...prev, [scorerPlayer.id]: { ...cur, pts: cur.pts + pts } }
        })
      }
    }

    try {
      const res = await fetch(`/api/leagues/${leagueId}/game/${gameId}/score-events`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, team: side, pts, scorer_name: scorerName }),
      })
      const data = await res.json()
      if (data.event) {
        setEvents(ev => ev.map(e => e.id === tempId ? { id: data.event.id, team: side, pts } : e))
      } else {
        throw new Error(data.error ?? 'Failed')
      }
    } catch {
      if (side === 'home') setHomeScore(s => Math.max(0, s - pts))
      else setAwayScore(s => Math.max(0, s - pts))
      setEvents(ev => ev.filter(e => e.id !== tempId))
    }
  }

  async function undo() {
    const [last, ...rest] = events
    if (!last) return
    if (last.team === 'home') setHomeScore(s => Math.max(0, s - last.pts))
    else setAwayScore(s => Math.max(0, s - last.pts))
    setEvents(rest)
    try {
      await fetch(`/api/leagues/${leagueId}/game/${gameId}/score-events`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, eventId: last.id.startsWith('temp-') ? undefined : last.id }),
      })
    } catch {}
  }

  async function recordStat(type: string) {
    if (!statTarget) return
    const { playerId, playerName, teamId } = statTarget

    // Optimistic local update
    setLiveStats(prev => {
      const cur = prev[playerId] ?? { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, foul: 0 }
      const key = type === 'foul' ? 'foul' : type === 'rebound' ? 'reb' : type === 'assist' ? 'ast' : type === 'steal' ? 'stl' : type === 'block' ? 'blk' : type === 'turnover' ? 'tov' : type as keyof LiveStat
      return { ...prev, [playerId]: { ...cur, [key]: (cur[key as keyof LiveStat] ?? 0) + 1 } }
    })

    setStatTarget(null)
    showToast(`${type} — ${playerName}`)

    // Build current stat row for this player and upsert
    const cur = liveStats[playerId] ?? { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, foul: 0 }
    const updated = { ...cur }
    const key = type === 'foul' ? 'foul' : type === 'rebound' ? 'reb' : type === 'assist' ? 'ast' : type === 'steal' ? 'stl' : type === 'block' ? 'blk' : type === 'turnover' ? 'tov' : type
    ;(updated as any)[key] = ((updated as any)[key] ?? 0) + 1

    await fetch(`/api/leagues/${leagueId}/game/${gameId}/live-stats`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin,
        players: [{
          name: playerName,
          team_id: teamId,
          pts: updated.pts,
          reb: updated.reb,
          ast: updated.ast,
          stl: updated.stl,
          blk: updated.blk,
          tov: updated.tov,
        }]
      })
    }).catch(() => {})
  }

  async function addPlayerOnTheFly() {
    if (!newPlayerName.trim() || !addingFor || !game) return
    setAddingPlayer(true)
    const teamId = addingFor === 'home' ? game.home_team.id : game.away_team.id
    // Call backfill with zero stats just to create the player
    const res = await fetch(`/api/leagues/${leagueId}/game/${gameId}/live-stats`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, players: [{ name: newPlayerName.trim(), team_id: teamId, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0 }] })
    })
    if (res.ok) {
      const newPlayer: LeaguePlayer = { id: `live_${Date.now()}`, display_name: newPlayerName.trim() }
      if (addingFor === 'home') setRosterHome(r => [...r, newPlayer])
      else setRosterAway(r => [...r, newPlayer])
      showToast(`${newPlayerName.trim()} added`)
    }
    setNewPlayerName('')
    setAddingFor(null)
    setAddingPlayer(false)
  }

  async function finishGame() {
    setFinishing(true)
    const finalHome = events.filter(e => e.team === 'home').reduce((s, e) => s + e.pts, 0)
    const finalAway = events.filter(e => e.team === 'away').reduce((s, e) => s + e.pts, 0)
    await fetch(`/api/leagues/${leagueId}/game/${gameId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, status: 'complete', home_score: finalHome, away_score: finalAway }),
    })
    setHomeScore(finalHome)
    setAwayScore(finalAway)
    setGameStatus('complete')
    setFinishing(false)
    setFinished(true)
  }

  async function handleRecapUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setUploadError('')
    const ext = file.name.split('.').pop()
    const path = `${gameId}/recap-${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage.from('recap-images').upload(path, file, { upsert: true })
    if (uploadErr) { setUploadError('Upload failed'); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('recap-images').getPublicUrl(path)
    await fetch(`/api/leagues/${leagueId}/game/${gameId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, recap_image_url: publicUrl }),
    })
    setRecapUrl(publicUrl)
    setUploading(false)
  }

  if (loading) return <main className="min-h-dvh flex items-center justify-center"><div className="text-white/40">Loading...</div></main>
  if (!game) return <main className="min-h-dvh flex items-center justify-center"><div className="text-white/40">Game not found</div></main>

  if (!unlocked) return (
    <main className="min-h-dvh flex flex-col p-5 max-w-lg mx-auto">
      <div className="pt-4 mb-6">
        <Link href={`/league/${leagueId}/game/${gameId}`} className="text-white/40 text-sm mb-4 block">← Game</Link>
        <div className="text-3xl mb-2">🔐</div>
        <h1 className="text-2xl font-black text-white">Admin Only</h1>
        <p className="text-white/40 text-sm mt-1">Enter PIN to start live scoring</p>
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

  if (finished || gameStatus === 'complete') {
    const homeWon = homeScore > awayScore
    return (
      <main className="min-h-dvh flex flex-col p-5 max-w-lg mx-auto">
        {recapUrl ? (
          <div className="relative w-full rounded-2xl overflow-hidden mb-5 aspect-square">
            <img src={recapUrl} alt="Game recap" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <p className="text-white/60 text-xs uppercase tracking-wider mb-1">Final</p>
              <p className="text-white font-black text-2xl">{homeWon ? game.home_team.name : game.away_team.name} wins</p>
              <p className="text-orange-400 font-black text-4xl">{homeScore}–{awayScore}</p>
            </div>
            <label className="absolute top-3 right-3 bg-black/50 text-white/60 text-xs px-3 py-1.5 rounded-full cursor-pointer">
              ✎ Replace
              <input type="file" accept="image/*" className="hidden" onChange={handleRecapUpload} />
            </label>
          </div>
        ) : (
          <div className="mb-5">
            <div className="text-center mb-3">
              <div className="text-5xl mb-3">🏆</div>
              <p className="text-orange-400 text-xs uppercase tracking-wider mb-1">Final</p>
              <p className="text-white font-black text-2xl mb-1">{homeWon ? game.home_team.name : game.away_team.name} wins!</p>
              <p className="text-white/50 font-black text-5xl">{homeScore}–{awayScore}</p>
            </div>
            <label className={`w-full mt-4 py-4 rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center gap-2 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              <span className="text-3xl">{uploading ? '⏳' : '📸'}</span>
              <span className="text-white font-semibold text-sm">{uploading ? 'Uploading...' : 'Add Recap Photo'}</span>
              <span className="text-white/30 text-xs">Tap to upload from camera roll</span>
              {uploadError && <span className="text-red-400 text-xs">{uploadError}</span>}
              <input type="file" accept="image/*" className="hidden" onChange={handleRecapUpload} />
            </label>
          </div>
        )}
        <Link href={`/league/${leagueId}/game/${gameId}`} className="w-full py-3 rounded-2xl font-bold bg-orange-500 text-white text-center block">View Box Score →</Link>
        <Link href={`/league/${leagueId}`} className="w-full py-3 rounded-2xl font-bold bg-white/10 text-white text-center block mt-2">← League</Link>
      </main>
    )
  }

  return (
    <main className="min-h-dvh flex flex-col select-none" style={{ touchAction: 'manipulation' }}>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-white/10 backdrop-blur border border-white/20 text-white text-sm font-semibold px-4 py-2 rounded-full pointer-events-none">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <Link href={`/league/${leagueId}/game/${gameId}`} className="text-white/40 text-sm">← Game</Link>
        <div className={`text-xs font-bold px-3 py-1 rounded-full ${gameStatus === 'live' ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'}`}>
          {gameStatus === 'live' ? '● LIVE' : 'NOT STARTED'}
        </div>
        <div className="text-white/30 text-xs">{game.round_label ?? 'Game'}</div>
      </div>

      {/* Scoreboard */}
      <div className="flex h-[45vh]">
        <button
          className={`flex-1 flex flex-col items-center justify-center transition-all duration-150 ${lastScored === 'home' ? 'bg-green-500/10' : ''} ${gameStatus === 'live' ? 'active:opacity-70' : 'cursor-default'}`}
          onClick={() => { if (gameStatus === 'live') { setTapping(t => t === 'home' ? null : 'home'); setSelectedScorer(null) } }}
          disabled={gameStatus !== 'live'}
        >
          <div className="text-white/50 text-sm font-semibold mb-2 uppercase tracking-wider px-3 text-center">{game.home_team.name}</div>
          <div className={`text-[6rem] font-black leading-none text-green-400 transition-transform duration-150 ${lastScored === 'home' ? 'scale-110' : 'scale-100'}`}>{homeScore}</div>
          {gameStatus === 'live' && tapping !== 'home' && <div className="mt-3 text-white/20 text-xs">TAP TO SCORE</div>}
        </button>

        <div className="flex items-center px-1 text-white/20 text-2xl font-thin">|</div>

        <button
          className={`flex-1 flex flex-col items-center justify-center transition-all duration-150 ${lastScored === 'away' ? 'bg-orange-500/10' : ''} ${gameStatus === 'live' ? 'active:opacity-70' : 'cursor-default'}`}
          onClick={() => { if (gameStatus === 'live') { setTapping(t => t === 'away' ? null : 'away'); setSelectedScorer(null) } }}
          disabled={gameStatus !== 'live'}
        >
          <div className="text-white/50 text-sm font-semibold mb-2 uppercase tracking-wider px-3 text-center">{game.away_team.name}</div>
          <div className={`text-[6rem] font-black leading-none text-orange-400 transition-transform duration-150 ${lastScored === 'away' ? 'scale-110' : 'scale-100'}`}>{awayScore}</div>
          {gameStatus === 'live' && tapping !== 'away' && <div className="mt-3 text-white/20 text-xs">TAP TO SCORE</div>}
        </button>
      </div>

      {/* Scorer picker */}
      {tapping && gameStatus === 'live' && (() => {
        const roster = tapping === 'home' ? rosterHome : rosterAway
        const scorerPlayer = roster.find(p => p.id === selectedScorer)
        const teamName = tapping === 'home' ? game.home_team.name : game.away_team.name
        const isHome = tapping === 'home'
        const teamId = isHome ? game.home_team.id : game.away_team.id
        return (
          <div className="px-4 py-3 bg-white/5 border-t border-white/10">
            {roster.length > 0 && (
              <div className="mb-3">
                <p className="text-white/30 text-xs text-center mb-2 uppercase tracking-wider">Who scored? (optional)</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {roster.map(p => (
                    <button key={p.id}
                      onClick={() => setSelectedScorer(prev => prev === p.id ? null : p.id)}
                      onContextMenu={e => { e.preventDefault(); setStatTarget({ playerId: p.id, playerName: p.display_name, teamId, side: tapping }); setTapping(null) }}
                      className={[
                        'px-3 py-1.5 rounded-xl text-sm font-semibold transition-all active:scale-95',
                        selectedScorer === p.id
                          ? isHome ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'
                          : 'bg-white/10 text-white/60 border border-white/10'
                      ].join(' ')}>
                      {p.display_name}
                    </button>
                  ))}
                  {/* Add player pill */}
                  <button
                    onClick={() => { setAddingFor(tapping); setTapping(null) }}
                    className="px-3 py-1.5 rounded-xl text-sm font-semibold bg-white/5 text-white/30 border border-dashed border-white/20 active:scale-95">
                    + Add
                  </button>
                </div>
              </div>
            )}
            <p className="text-white/40 text-xs text-center mb-2 uppercase tracking-wider">
              {scorerPlayer ? scorerPlayer.display_name + ' scored...' : teamName + ' scored...'}
            </p>
            <div className="flex gap-3">
              {([1, 2, 3] as const).map(pts => (
                <button key={pts}
                  onClick={() => { score(tapping, pts, scorerPlayer?.display_name); setSelectedScorer(null) }}
                  className={['flex-1 py-4 rounded-2xl font-black text-2xl active:scale-95 transition-transform', isHome ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'].join(' ')}>
                  {pts}
                </button>
              ))}
            </div>
            <button onClick={() => { setTapping(null); setSelectedScorer(null) }} className="w-full mt-2 py-2 text-white/30 text-sm">Cancel</button>
          </div>
        )
      })()}

      {/* Bottom bar */}
      <div className="px-4 py-3 border-t border-white/10 space-y-2">
        {gameStatus === 'scheduled' && (
          <button onClick={startGame} className="w-full py-3 rounded-xl bg-green-500 text-white font-bold">▶ Start Game</button>
        )}

        {gameStatus === 'live' && (
          <div className="flex gap-2">
            <button onClick={undo} disabled={events.length === 0}
              className="flex-1 py-3 rounded-xl bg-white/10 text-white font-semibold border border-white/20 disabled:opacity-30 text-sm">
              ↩ Undo
            </button>
            <button onClick={() => { setTapping(null); setShowBreakdown(s => !s) }}
              className="py-3 px-4 rounded-xl bg-white/10 text-white/60 border border-white/10 text-sm">
              📊 Stats
            </button>
            <button
              onClick={() => { if (homeScore !== awayScore) finishGame() }}
              className={`flex-1 py-3 rounded-xl font-bold text-white text-sm ${homeScore === awayScore ? 'bg-white/10 text-white/30' : 'bg-orange-500'}`}>
              {homeScore === awayScore ? "It's tied" : finishing ? 'Saving...' : 'Finish →'}
            </button>
          </div>
        )}

        {/* Recent events feed */}
        {events.length > 0 && (
          <div className="mt-2 space-y-1">
            {events.slice(0, 4).map((e, i) => (
              <div key={e.id} className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${e.team === 'home' ? 'bg-green-400' : 'bg-orange-400'}`} />
                <span className={`text-sm ${e.team === 'home' ? 'text-green-400' : 'text-orange-400'}`}>
                  {e.team === 'home' ? game.home_team.name : game.away_team.name}
                </span>
                <span className="text-white/40 text-sm">+{e.pts}</span>
                {i === 0 && <span className="text-white/20 text-xs ml-auto">latest</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stat recording sheet */}
      {statTarget && (
        <div className="fixed inset-0 bg-black/80 flex flex-col justify-end z-50">
          <div className="bg-[#1a1a1a] rounded-t-3xl p-5">
            <p className="text-white font-bold text-lg mb-1">{statTarget.playerName}</p>
            <p className="text-white/40 text-xs mb-4 uppercase tracking-wider">Record stat</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {STAT_TYPES.map(({ type, label }) => (
                <button key={type} onClick={() => recordStat(type)}
                  className="py-3 rounded-xl bg-white/10 text-white font-semibold text-sm active:scale-95 transition-transform">
                  {label}
                </button>
              ))}
            </div>
            <button onClick={() => setStatTarget(null)} className="w-full py-3 text-white/30 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Add player sheet */}
      {addingFor && (
        <div className="fixed inset-0 bg-black/80 flex flex-col justify-end z-50">
          <div className="bg-[#1a1a1a] rounded-t-3xl p-5">
            <p className="text-white font-bold text-lg mb-1">Add Player</p>
            <p className="text-white/40 text-xs mb-4 uppercase tracking-wider">
              {addingFor === 'home' ? game.home_team.name : game.away_team.name}
            </p>
            <input
              value={newPlayerName}
              onChange={e => setNewPlayerName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPlayerOnTheFly()}
              placeholder="Player name"
              autoFocus
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500 mb-3"
            />
            <button onClick={addPlayerOnTheFly} disabled={!newPlayerName.trim() || addingPlayer}
              className="w-full py-3 rounded-2xl font-bold bg-orange-500 text-white disabled:opacity-40 mb-2">
              {addingPlayer ? 'Adding...' : 'Add Player'}
            </button>
            <button onClick={() => { setAddingFor(null); setNewPlayerName('') }} className="w-full py-3 text-white/30 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Mid-game stats breakdown */}
      {showBreakdown && (
        <div className="fixed inset-0 bg-black/90 flex flex-col z-50">
          <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-white/10">
            <h2 className="text-white font-black text-lg">Live Stats</h2>
            <button onClick={() => setShowBreakdown(false)} className="text-white/30 px-3 py-1.5 rounded-lg bg-white/10 text-sm">Close</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {([['home', game.home_team.name, rosterHome], ['away', game.away_team.name, rosterAway]] as const).map(([side, name, roster]) => (
              <div key={side}>
                <p className={`text-xs uppercase tracking-wider font-bold mb-2 ${side === 'home' ? 'text-green-400' : 'text-orange-400'}`}>{name}</p>
                <div className="card overflow-hidden">
                  <div className="grid grid-cols-7 px-3 py-2 border-b border-white/5">
                    <span className="text-white/30 text-xs col-span-2">Player</span>
                    {['PTS','REB','AST','STL','BLK','TOV'].map(h => (
                      <span key={h} className="text-white/30 text-xs text-center">{h}</span>
                    ))}
                  </div>
                  {roster.map(p => {
                    const s = liveStats[p.id] ?? { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, foul: 0 }
                    return (
                      <div key={p.id} className="grid grid-cols-7 px-3 py-2.5 border-b border-white/5 last:border-0">
                        <span className="text-white text-sm col-span-2 truncate">{p.display_name}</span>
                        {[s.pts, s.reb, s.ast, s.stl, s.blk, s.tov].map((v, i) => (
                          <span key={i} className="text-white/60 text-sm text-center">{v}</span>
                        ))}
                      </div>
                    )
                  })}
                  {/* Add player from breakdown too */}
                  <button
                    onClick={() => { setAddingFor(side); setShowBreakdown(false) }}
                    className="w-full py-2.5 text-white/30 text-xs border-t border-white/5">
                    + Add player
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-white/10">
            <div className="flex gap-2 text-center">
              <div className="flex-1 bg-white/5 rounded-xl py-3">
                <p className="text-green-400 font-black text-2xl">{homeScore}</p>
                <p className="text-white/30 text-xs">{game.home_team.name}</p>
              </div>
              <div className="flex items-center text-white/20 font-thin text-xl">–</div>
              <div className="flex-1 bg-white/5 rounded-xl py-3">
                <p className="text-orange-400 font-black text-2xl">{awayScore}</p>
                <p className="text-white/30 text-xs">{game.away_team.name}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stat target trigger — long press on player pill handled via onContextMenu above */}
      {/* For mobile: tap player to select as scorer, hold to record a non-scoring stat */}
    </main>
  )
}
