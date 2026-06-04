'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Team = { id: string; name: string }
type ScoreEvent = { id: string; team: 'home' | 'away'; pts: number }
type PlayerRow = { name: string; team_id: string; pts: number; reb: number; ast: number; stl: number; blk: number; tov: number }
type GameInfo = {
  id: string; status: string; round_label: string | null
  home_team: Team; away_team: Team
  home_score: number | null; away_score: number | null
  recap_image_url: string | null
}

export default function LiveScoringPage() {
  const { id: leagueId, gameId } = useParams() as { id: string; gameId: string }

  const [pin, setPin] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [pinError, setPinError] = useState('')
  const [verifying, setVerifying] = useState(false)

  const [game, setGame] = useState<GameInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)
  const [events, setEvents] = useState<ScoreEvent[]>([])
  const [tapping, setTapping] = useState<'home' | 'away' | null>(null)
  const [lastScored, setLastScored] = useState<'home' | 'away' | null>(null)
  const [gameStatus, setGameStatus] = useState('scheduled')

  const [showStats, setShowStats] = useState(false)
  const [players, setPlayers] = useState<PlayerRow[]>([{ name: '', team_id: '', pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0 }])

  const [finishing, setFinishing] = useState(false)
  const [finished, setFinished] = useState(false)

  // Recap image
  const [recapUrl, setRecapUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  useEffect(() => {
    fetch(`/api/leagues/${leagueId}/game/${gameId}`)
      .then(r => r.json())
      .then(d => {
        if (d.id) {
          setGame(d)
          setGameStatus(d.status ?? 'scheduled')
          setHomeScore(d.home_score ?? 0)
          setAwayScore(d.away_score ?? 0)
          setRecapUrl(d.recap_image_url ?? null)
        }
        setLoading(false)
      })
  }, [leagueId, gameId])

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

  function score(side: 'home' | 'away', pts: 1 | 2 | 3) {
    if (side === 'home') setHomeScore(s => s + pts)
    else setAwayScore(s => s + pts)
    const id = Math.random().toString(36).slice(2)
    setEvents(ev => [{ id, team: side, pts }, ...ev])
    setLastScored(side)
    setTapping(null)
    setTimeout(() => setLastScored(null), 500)
  }

  function undo() {
    const [last, ...rest] = events
    if (!last) return
    if (last.team === 'home') setHomeScore(s => Math.max(0, s - last.pts))
    else setAwayScore(s => Math.max(0, s - last.pts))
    setEvents(rest)
  }

  function addPlayer() {
    setPlayers(p => [...p, { name: '', team_id: game?.home_team.id ?? '', pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0 }])
  }

  async function finishGame() {
    setFinishing(true)
    await fetch(`/api/leagues/${leagueId}/game/${gameId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, status: 'complete', home_score: homeScore, away_score: awayScore }),
    })
    const filledPlayers = players.filter(p => p.name.trim() && p.team_id)
    if (filledPlayers.length > 0) {
      await fetch(`/api/leagues/${leagueId}/game/${gameId}/live-stats`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, players: filledPlayers }),
      })
    }
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

    const { error: uploadErr } = await supabase.storage
      .from('recap-images')
      .upload(path, file, { upsert: true })

    if (uploadErr) { setUploadError('Upload failed'); setUploading(false); return }

    const { data: { publicUrl } } = supabase.storage
      .from('recap-images')
      .getPublicUrl(path)

    await fetch(`/api/leagues/${leagueId}/game/${gameId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, recap_image_url: publicUrl }),
    })

    setRecapUrl(publicUrl)
    setUploading(false)
  }

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
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3
                     text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500" />
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

        {/* Recap image — show if uploaded, else show upload prompt */}
        {recapUrl ? (
          <div className="relative w-full rounded-2xl overflow-hidden mb-5 aspect-square">
            <img src={recapUrl} alt="Game recap" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <p className="text-white/60 text-xs uppercase tracking-wider mb-1">Final</p>
              <p className="text-white font-black text-2xl">
                {homeWon ? game.home_team.name : game.away_team.name} wins
              </p>
              <p className="text-orange-400 font-black text-4xl">{homeScore}–{awayScore}</p>
            </div>
            {/* Replace image */}
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
              <p className="text-white font-black text-2xl mb-1">
                {homeWon ? game.home_team.name : game.away_team.name} wins!
              </p>
              <p className="text-white/50 font-black text-5xl">{homeScore}–{awayScore}</p>
            </div>

            {/* Upload CTA */}
            <label className={`w-full mt-4 py-4 rounded-2xl border-2 border-dashed
              border-white/20 flex flex-col items-center gap-2 cursor-pointer
              hover:border-orange-500/50 transition-colors
              ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              <span className="text-3xl">{uploading ? '⏳' : '📸'}</span>
              <span className="text-white font-semibold text-sm">
                {uploading ? 'Uploading...' : 'Add Recap Photo'}
              </span>
              <span className="text-white/30 text-xs">Tap to upload from camera roll</span>
              {uploadError && <span className="text-red-400 text-xs">{uploadError}</span>}
              <input type="file" accept="image/*" className="hidden" onChange={handleRecapUpload} />
            </label>
          </div>
        )}

        <Link href={`/league/${leagueId}/game/${gameId}`}
          className="w-full py-3 rounded-2xl font-bold bg-orange-500 text-white text-center block">
          View Box Score →
        </Link>
        <Link href={`/league/${leagueId}`}
          className="w-full py-3 rounded-2xl font-bold bg-white/10 text-white text-center block mt-2">
          ← League
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-dvh flex flex-col select-none" style={{ touchAction: 'manipulation' }}>

      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <Link href={`/league/${leagueId}/game/${gameId}`} className="text-white/40 text-sm">← Game</Link>
        <div className={`text-xs font-bold px-3 py-1 rounded-full
          ${gameStatus === 'live' ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'}`}>
          {gameStatus === 'live' ? '● LIVE' : 'NOT STARTED'}
        </div>
        <div className="text-white/30 text-xs">{game.round_label ?? 'Game'}</div>
      </div>

      <div className="flex h-[50vh]">
        <button
          className={`flex-1 flex flex-col items-center justify-center transition-all duration-150
            ${lastScored === 'home' ? 'bg-green-500/10' : ''}
            ${gameStatus === 'live' ? 'active:opacity-70' : 'cursor-default'}`}
          onClick={() => gameStatus === 'live' && setTapping(t => t === 'home' ? null : 'home')}
          disabled={gameStatus !== 'live'}
        >
          <div className="text-white/50 text-sm font-semibold mb-2 uppercase tracking-wider px-3 text-center">
            {game.home_team.name}
          </div>
          <div className={`text-[6rem] font-black leading-none text-green-400 transition-transform duration-150
            ${lastScored === 'home' ? 'scale-110' : 'scale-100'}`}>
            {homeScore}
          </div>
          {gameStatus === 'live' && tapping !== 'home' && (
            <div className="mt-3 text-white/20 text-xs">TAP TO SCORE</div>
          )}
        </button>

        <div className="flex items-center px-1 text-white/20 text-2xl font-thin">|</div>

        <button
          className={`flex-1 flex flex-col items-center justify-center transition-all duration-150
            ${lastScored === 'away' ? 'bg-orange-500/10' : ''}
            ${gameStatus === 'live' ? 'active:opacity-70' : 'cursor-default'}`}
          onClick={() => gameStatus === 'live' && setTapping(t => t === 'away' ? null : 'away')}
          disabled={gameStatus !== 'live'}
        >
          <div className="text-white/50 text-sm font-semibold mb-2 uppercase tracking-wider px-3 text-center">
            {game.away_team.name}
          </div>
          <div className={`text-[6rem] font-black leading-none text-orange-400 transition-transform duration-150
            ${lastScored === 'away' ? 'scale-110' : 'scale-100'}`}>
            {awayScore}
          </div>
          {gameStatus === 'live' && tapping !== 'away' && (
            <div className="mt-3 text-white/20 text-xs">TAP TO SCORE</div>
          )}
        </button>
      </div>

      {tapping && gameStatus === 'live' && (
        <div className="px-4 py-3 bg-white/5 border-t border-white/10">
          <p className="text-white/30 text-xs text-center mb-3 uppercase tracking-wider">
            {tapping === 'home' ? game.home_team.name : game.away_team.name} scored...
          </p>
          <div className="flex gap-3">
            {([1, 2, 3] as const).map(pts => (
              <button key={pts} onClick={() => score(tapping, pts)}
                className={`flex-1 py-4 rounded-2xl font-black text-2xl active:scale-95 transition-transform
                  ${tapping === 'home'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'}`}>
                {pts}
              </button>
            ))}
          </div>
          <button onClick={() => setTapping(null)} className="w-full mt-2 py-2 text-white/30 text-sm">
            Cancel
          </button>
        </div>
      )}

      <div className="px-4 py-3 border-t border-white/10 space-y-2">
        {gameStatus === 'scheduled' && (
          <button onClick={startGame}
            className="w-full py-3 rounded-xl bg-green-500 text-white font-bold">
            ▶ Start Game
          </button>
        )}

        {gameStatus === 'live' && (
          <div className="flex gap-2">
            <button onClick={undo} disabled={events.length === 0}
              className="flex-1 py-3 rounded-xl bg-white/10 text-white font-semibold border border-white/20 disabled:opacity-30">
              ↩ Undo
            </button>
            <button onClick={() => { setTapping(null); setShowStats(s => !s) }}
              className="py-3 px-4 rounded-xl bg-white/10 text-white/60 border border-white/10 text-sm">
              📋 Stats
            </button>
            <button
              onClick={() => { if (homeScore !== awayScore) { setTapping(null); setShowStats(true) } }}
              className={`flex-1 py-3 rounded-xl font-bold text-white
                ${homeScore === awayScore ? 'bg-white/10 text-white/30' : 'bg-orange-500'}`}>
              {homeScore === awayScore ? "It's tied" : 'Finish →'}
            </button>
          </div>
        )}

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

      {showStats && game && (
        <div className="fixed inset-0 bg-black/90 flex flex-col z-50">
          <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-white/10">
            <div>
              <h2 className="text-white font-black text-lg">Player Stats</h2>
              <p className="text-white/40 text-xs">Optional — fill what you know</p>
            </div>
            <button onClick={() => setShowStats(false)}
              className="text-white/30 px-3 py-1.5 rounded-lg bg-white/10 text-sm">Close</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-32">
            {players.map((p, i) => (
              <div key={i} className="card p-3 space-y-2 border-white/5">
                <div className="flex gap-2">
                  <input value={p.name}
                    onChange={e => setPlayers(pl => pl.map((r, j) => j === i ? { ...r, name: e.target.value } : r))}
                    placeholder="Player name"
                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2
                               text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-orange-500" />
                  <select value={p.team_id}
                    onChange={e => setPlayers(pl => pl.map((r, j) => j === i ? { ...r, team_id: e.target.value } : r))}
                    className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none">
                    <option value={game.home_team.id}>{game.home_team.name}</option>
                    <option value={game.away_team.id}>{game.away_team.name}</option>
                  </select>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {(['pts','reb','ast','stl','blk','tov'] as const).map(stat => (
                    <div key={stat}>
                      <label className="text-white/30 text-xs block text-center mb-1 uppercase">{stat}</label>
                      <input type="number" min={0} value={p[stat]}
                        onChange={e => setPlayers(pl => pl.map((r, j) => j === i ? { ...r, [stat]: Number(e.target.value) } : r))}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-1 py-1.5
                                   text-white text-sm text-center focus:outline-none focus:border-orange-500" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={addPlayer}
              className="w-full py-2.5 rounded-xl bg-white/10 text-white/50 text-sm border border-white/10">
              + Add Player
            </button>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#0f0f1a]/95 border-t border-white/10">
            <button onClick={() => { setShowStats(false); finishGame() }}
              disabled={finishing || homeScore === awayScore}
              className="w-full py-3 rounded-2xl font-bold bg-orange-500 text-white disabled:opacity-40">
              {finishing ? 'Saving...' : `Finish Game · ${homeScore}–${awayScore}`}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
