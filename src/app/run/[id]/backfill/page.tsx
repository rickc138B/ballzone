'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { isOrganizerOfRun, getShareToken } from '@/lib/session-token'
import { cn } from '@/lib/utils'

interface BackfillPlayer {
  name: string
  team: 'a' | 'b'
}

interface BackfillEvent {
  team: 'a' | 'b'
  points: 1 | 2 | 3
  scorer: string
}

export default function BackfillPage() {
  const params = useParams()
  const router = useRouter()
  const runId = params.id as string
  const isOrganizer = isOrganizerOfRun(runId)

  const [step, setStep] = useState<'teams' | 'score' | 'events' | 'saving' | 'done'>('teams')
  const [teamAName, setTeamAName] = useState('')
  const [teamBName, setTeamBName] = useState('')
  const [players, setPlayers] = useState<BackfillPlayer[]>([])
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerTeam, setNewPlayerTeam] = useState<'a' | 'b'>('a')
  const [scoreA, setScoreA] = useState(0)
  const [scoreB, setScoreB] = useState(0)
  const [events, setEvents] = useState<BackfillEvent[]>([])
  const [newEvent, setNewEvent] = useState<BackfillEvent>({ team: 'a', points: 2, scorer: '' })
  const [error, setError] = useState('')

  if (!isOrganizer) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-xl font-bold text-white mb-2">Organizer only</h1>
        <button onClick={() => router.push(`/run/${runId}`)} className="mt-4 text-orange-400 text-sm underline">← Back</button>
      </main>
    )
  }

  function addPlayer() {
    if (!newPlayerName.trim()) return
    setPlayers(p => [...p, { name: newPlayerName.trim(), team: newPlayerTeam }])
    setNewPlayerName('')
  }

  function removePlayer(i: number) {
    setPlayers(p => p.filter((_, idx) => idx !== i))
  }

  function addEvent() {
    if (!newEvent.scorer.trim()) return
    setEvents(e => [...e, { ...newEvent, scorer: newEvent.scorer.trim() }])
    setNewEvent(e => ({ ...e, scorer: '' }))
  }

  function removeEvent(i: number) {
    setEvents(e => e.filter((_, idx) => idx !== i))
  }

  // Validate: events total should match score
  function eventsMatchScore() {
    const totA = events.filter(e => e.team === 'a').reduce((s, e) => s + e.points, 0)
    const totB = events.filter(e => e.team === 'b').reduce((s, e) => s + e.points, 0)
    return totA === scoreA && totB === scoreB
  }

  async function save() {
    setStep('saving')
    setError('')
    const shareToken = getShareToken(runId)
    const res = await fetch(`/api/runs/${runId}/backfill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-share-token': shareToken ?? '',
      },
      body: JSON.stringify({
        team_a_name: teamAName || 'Team A',
        team_b_name: teamBName || 'Team B',
        score_a: scoreA,
        score_b: scoreB,
        players,
        events,
      }),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Failed to save')
      setStep('events')
      return
    }
    setStep('done')
  }

  if (step === 'done') {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-xl font-bold text-white mb-2">Game saved!</h1>
        <p className="text-white/50 text-sm mb-6">Historical game has been recorded.</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => { setStep('teams'); setPlayers([]); setEvents([]); setScoreA(0); setScoreB(0) }}
            className="w-full py-3 rounded-2xl font-bold bg-orange-500 text-white"
          >
            Add Another Game
          </button>
          <button
            onClick={() => router.push(`/run/${runId}`)}
            className="w-full py-3 rounded-2xl font-bold bg-white/10 text-white"
          >
            Back to Run
          </button>
        </div>
      </main>
    )
  }

  if (step === 'saving') {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <div className="text-white/40">Saving...</div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh flex flex-col p-5 max-w-lg mx-auto pb-10">
      <div className="pt-4 mb-6">
        <button onClick={() => router.push(`/run/${runId}`)} className="text-white/40 text-sm mb-4 block">← Back</button>
        <h1 className="text-2xl font-black text-white">Add Historical Game</h1>
        <p className="text-white/40 text-sm mt-1">Record a game that's already been played</p>
      </div>

      {/* Step tabs */}
      <div className="flex gap-1 mb-6">
        {(['teams', 'score', 'events'] as const).map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(s)}
            className={cn(
              'flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all',
              step === s ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/40'
            )}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {/* Step 1: Teams + players */}
      {step === 'teams' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-green-400 text-xs uppercase tracking-wider mb-1 block">Team A</label>
              <input
                value={teamAName}
                onChange={e => setTeamAName(e.target.value)}
                placeholder="Skins"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5
                           text-white placeholder:text-white/30 focus:outline-none focus:border-green-400 text-sm"
              />
            </div>
            <div>
              <label className="text-orange-400 text-xs uppercase tracking-wider mb-1 block">Team B</label>
              <input
                value={teamBName}
                onChange={e => setTeamBName(e.target.value)}
                placeholder="Shirts"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5
                           text-white placeholder:text-white/30 focus:outline-none focus:border-orange-400 text-sm"
              />
            </div>
          </div>

          <div>
            <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Add Players (optional)</p>
            <div className="flex gap-2 mb-3">
              <input
                value={newPlayerName}
                onChange={e => setNewPlayerName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPlayer()}
                placeholder="Player name"
                className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2.5
                           text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500 text-sm"
              />
              <button
                onClick={() => setNewPlayerTeam(t => t === 'a' ? 'b' : 'a')}
                className={cn(
                  'px-3 py-2.5 rounded-xl text-sm font-bold border transition-all',
                  newPlayerTeam === 'a'
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                )}
              >
                {newPlayerTeam === 'a' ? teamAName || 'A' : teamBName || 'B'}
              </button>
              <button
                onClick={addPlayer}
                disabled={!newPlayerName.trim()}
                className="px-4 py-2.5 rounded-xl bg-orange-500 text-white font-bold text-sm disabled:opacity-30"
              >
                +
              </button>
            </div>
            {players.length > 0 && (
              <div className="space-y-1">
                {players.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-semibold',
                      p.team === 'a' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
                    )}>
                      {p.team === 'a' ? teamAName || 'A' : teamBName || 'B'}
                    </span>
                    <span className="text-white/70 text-sm flex-1">{p.name}</span>
                    <button onClick={() => removePlayer(i)} className="text-white/20 text-xs px-2">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setStep('score')}
            className="w-full py-4 rounded-2xl font-bold bg-orange-500 text-white"
          >
            Next: Final Score →
          </button>
        </div>
      )}

      {/* Step 2: Final score */}
      {step === 'score' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {(['a', 'b'] as const).map(side => {
              const val = side === 'a' ? scoreA : scoreB
              const set = side === 'a' ? setScoreA : setScoreB
              const name = side === 'a' ? (teamAName || 'Team A') : (teamBName || 'Team B')
              const color = side === 'a' ? 'text-green-400' : 'text-orange-400'
              return (
                <div key={side} className="text-center">
                  <p className={`${color} text-xs uppercase tracking-wider mb-2`}>{name}</p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => set(v => Math.max(0, v - 1))}
                      className="w-10 h-10 rounded-full bg-white/10 text-white font-bold text-lg"
                    >−</button>
                    <span className={`text-5xl font-black ${color}`}>{val}</span>
                    <button
                      onClick={() => set(v => v + 1)}
                      className="w-10 h-10 rounded-full bg-white/10 text-white font-bold text-lg"
                    >+</button>
                  </div>
                </div>
              )
            })}
          </div>

          {scoreA === scoreB && scoreA > 0 && (
            <p className="text-yellow-400 text-xs text-center">⚠ Tied scores — one team must win</p>
          )}

          <button
            onClick={() => setStep('events')}
            disabled={scoreA === scoreB && scoreA > 0}
            className="w-full py-4 rounded-2xl font-bold bg-orange-500 text-white disabled:opacity-40"
          >
            Next: Add Scoring Events →
          </button>
          <p className="text-white/30 text-xs text-center">Events are optional — skip to save with just the score</p>
          <button
            onClick={save}
            className="w-full py-3 rounded-2xl font-semibold bg-white/10 text-white/60 text-sm"
          >
            Save score only (no events)
          </button>
        </div>
      )}

      {/* Step 3: Scoring events */}
      {step === 'events' && (
        <div className="space-y-4">
          <div className="card p-3 flex gap-4 text-center text-sm">
            <div className="flex-1">
              <span className="text-green-400 font-black text-lg">
                {events.filter(e => e.team === 'a').reduce((s, e) => s + e.points, 0)}
              </span>
              <span className="text-white/30"> / {scoreA}</span>
              <p className="text-white/30 text-xs">{teamAName || 'Team A'}</p>
            </div>
            <div className="flex-1">
              <span className="text-orange-400 font-black text-lg">
                {events.filter(e => e.team === 'b').reduce((s, e) => s + e.points, 0)}
              </span>
              <span className="text-white/30"> / {scoreB}</span>
              <p className="text-white/30 text-xs">{teamBName || 'Team B'}</p>
            </div>
          </div>

          {/* Add event row */}
          <div className="flex gap-2">
            <button
              onClick={() => setNewEvent(e => ({ ...e, team: e.team === 'a' ? 'b' : 'a' }))}
              className={cn(
                'px-3 py-2.5 rounded-xl text-xs font-bold border shrink-0',
                newEvent.team === 'a'
                  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                  : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
              )}
            >
              {newEvent.team === 'a' ? teamAName || 'A' : teamBName || 'B'}
            </button>
            <input
              value={newEvent.scorer}
              onChange={e => setNewEvent(ev => ({ ...ev, scorer: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addEvent()}
              placeholder="Scorer name"
              className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2.5
                         text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500 text-sm"
            />
            <div className="flex gap-1">
              {([1, 2, 3] as const).map(pts => (
                <button
                  key={pts}
                  onClick={() => setNewEvent(e => ({ ...e, points: pts }))}
                  className={cn(
                    'w-9 h-10 rounded-xl text-sm font-black border',
                    newEvent.points === pts
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white/10 text-white/50 border-white/10'
                  )}
                >
                  {pts}
                </button>
              ))}
            </div>
            <button
              onClick={addEvent}
              disabled={!newEvent.scorer.trim()}
              className="px-3 py-2.5 rounded-xl bg-orange-500 text-white font-bold text-sm disabled:opacity-30"
            >
              +
            </button>
          </div>

          {/* Event list */}
          {events.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {events.map((e, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={cn('w-2 h-2 rounded-full shrink-0', e.team === 'a' ? 'bg-green-400' : 'bg-orange-400')} />
                  <span className={cn('text-sm', e.team === 'a' ? 'text-green-400' : 'text-orange-400')}>
                    {e.team === 'a' ? teamAName || 'A' : teamBName || 'B'}
                  </span>
                  <span className="text-white/40 text-sm">+{e.points}</span>
                  <span className="text-white/60 text-sm flex-1">{e.scorer}</span>
                  <button onClick={() => removeEvent(i)} className="text-white/20 text-xs px-2">✕</button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          {events.length > 0 && !eventsMatchScore() && (
            <p className="text-yellow-400 text-xs text-center">
              ⚠ Event totals don't match final score — you can still save
            </p>
          )}

          <button
            onClick={save}
            className="w-full py-4 rounded-2xl font-bold bg-orange-500 text-white"
          >
            Save Game →
          </button>
        </div>
      )}
    </main>
  )
}
