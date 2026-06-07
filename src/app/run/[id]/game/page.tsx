'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useGameSession } from '@/hooks/useGameSession'
import { getShareToken, isOrganizerOfRun } from '@/lib/session-token'
import { getSupabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export default function GamePage() {
  const params = useParams()
  const router = useRouter()
  const runId = params.id as string
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [isOrganizer, setIsOrganizer] = useState<boolean>(false)

  useEffect(() => {
    const token = getShareToken(runId) ?? new URLSearchParams(window.location.search).get('token')
    setShareToken(token)
    if (isOrganizerOfRun(runId) || !!new URLSearchParams(window.location.search).get('token')) {
      setIsOrganizer(true)
    }
  }, [runId])

  const { state, actions } = useGameSession(runId, shareToken)
  const { game, teamA, teamB, scoreEvents } = state

  const [pointSelector, setPointSelector] = useState<'a' | 'b' | null>(null)
  const [selectedScorer, setSelectedScorer] = useState<string | null>(null)
  const [lastScored, setLastScored] = useState<'a' | 'b' | null>(null)
  const [tieError, setTieError] = useState(false)
  const [showAttribution, setShowAttribution] = useState(false)
  const [scorerNames, setScorerNames] = useState<Record<string, string>>({})
  const [savingAttribution, setSavingAttribution] = useState(false)
  const [copiedResult, setCopiedResult] = useState(false)
  const [attributionDone, setAttributionDone] = useState(false)
  const [commentary, setCommentary] = useState<string | null>(null)
  const [commentaryLoading, setCommentaryLoading] = useState(false)
  const [commentaryFetched, setCommentaryFetched] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [teamAName, setTeamAName] = useState('Team A')
  const [teamBName, setTeamBName] = useState('Team B')
  const [teamAssignments, setTeamAssignments] = useState<Record<string, 'a' | 'b' | null>>({})
  const [settingUp, setSettingUp] = useState(false)
  const setupJustCompleted = useRef(false)
  const [players, setPlayers] = useState<{id: string, name: string}[]>([])
  const [walkInName, setWalkInName] = useState('')
  const [startScoreA, setStartScoreA] = useState(0)
  const [startScoreB, setStartScoreB] = useState(0)
  const [showStartScore, setShowStartScore] = useState(false)
  const [floatingReactions, setFloatingReactions] = useState<{id: string; emoji: string; x: number}[]>([])
  const [fanReaction, setFanReaction] = useState<string | null>(null)

  useEffect(() => {
    async function checkOrganizer() {
      if (isOrganizer) return // already confirmed via localStorage
      const headers: Record<string, string> = {}
      if (shareToken) headers['x-share-token'] = shareToken
      const res = await fetch(`/api/runs/${runId}`, { headers })
      if (!res.ok) return
      const data = await res.json()
      if (data.isOrganizer) setIsOrganizer(true)
    }
    checkOrganizer()
  }, [runId, shareToken])

  useEffect(() => {
    async function fetchPlayers() {
      const res = await fetch(`/api/runs/${runId}`)
      if (!res.ok) return
      const data = await res.json()
      const inPlayers = (data.attendance ?? [])
        .filter((a: any) => a.status === 'in' || a.status === 'late')
        .map((a: any) => ({
          id: a.participant_id,
          name: a.participant?.display_name ?? 'Anonymous',
        }))
      setPlayers(inPlayers)
    }
    fetchPlayers()
  }, [runId])

  useEffect(() => {
    if (!game?.id) return
    const { getSupabase } = require('@/lib/supabase')
    const supabase = getSupabase()
    const ch = supabase
      .channel(`game-reactions:${game.id}`)
      .on('broadcast', { event: 'react' }, ({ payload }: any) => {
        const id = Math.random().toString(36).slice(2)
        const x = 10 + Math.random() * 80
        setFloatingReactions(prev => [...prev, { id, emoji: payload.emoji, x }])
        setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 2000)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [game?.id])

  useEffect(() => {
    if (!state.loading && game?.status === 'live') {
      setupJustCompleted.current = false
      setNeedsSetup(false)
    } else if (!state.loading && !settingUp && !setupJustCompleted.current && (!game || game.status === 'complete')) {
      setNeedsSetup(true)
    }
    if (teamA?.name) setTeamAName(teamA.name)
    if (teamB?.name) setTeamBName(teamB.name)
  }, [state.loading, game, teamA, teamB, settingUp])

  async function saveAttribution() {
    if (savingAttribution) return
    setSavingAttribution(true)
    const supabase = getSupabase()
    const updates = Object.entries(scorerNames).filter(([, name]) => name.trim())
    await Promise.all(updates.map(([id, name]) =>
      supabase.from('score_events').update({ scorer_name: name.trim() }).eq('id', id)
    ))
    setSavingAttribution(false)
    setAttributionDone(true)
    setShowAttribution(false)
  }

  function addWalkIn() {
    const name = walkInName.trim()
    if (!name) return
    const id = `walkin_${Date.now()}`
    setPlayers(prev => [...prev, { id, name }])
    setTeamAssignments(prev => ({ ...prev, [id]: null }))
    setWalkInName('')
  }

  function toggleAssignment(playerId: string) {
    setTeamAssignments(prev => {
      const cur = prev[playerId] ?? null
      const next = cur === null ? 'a' : cur === 'a' ? 'b' : null
      return { ...prev, [playerId]: next }
    })
  }

  async function setupGame() {
    if (settingUp) return
    setSettingUp(true)
    const supabase = getSupabase()

    const { data: teamARow } = await supabase
      .from('run_teams')
      .insert({ session_id: runId, name: teamAName, color: '#22c55e', status: 'on_court' })
      .select().single()

    const { data: teamBRow } = await supabase
      .from('run_teams')
      .insert({ session_id: runId, name: teamBName, color: '#f97316', status: 'on_court' })
      .select().single()

    if (!teamARow || !teamBRow) { setSettingUp(false); return }

    await supabase.from('sessions').upsert(
      { id: runId, run_id: runId, status: 'active' },
      { onConflict: 'id' }
    )

    const { data: games } = await supabase
      .from('games')
      .select('sequence_number')
      .eq('session_id', runId)
      .order('sequence_number', { ascending: false })
      .limit(1)

    const nextSeq = (games?.[0]?.sequence_number ?? 0) + 1

    const { data: newGame } = await supabase.from('games').insert({
      session_id: runId,
      sequence_number: nextSeq,
      team_a_id: teamARow.id,
      team_b_id: teamBRow.id,
      status: 'live',
      started_at: new Date().toISOString(),
      score_a: startScoreA,
      score_b: startScoreB,
    }).select().single()

    if (newGame && (startScoreA > 0 || startScoreB > 0)) {
      await supabase.from('score_events').insert({
        game_id: newGame.id,
        team_id: teamARow.id,
        points: 0,
        scorer_name: '↩ Joined at ' + startScoreA + '–' + startScoreB,
        voided: false,
      })
    }

    // Small delay to allow realtime to pick up the new game
    await new Promise(r => setTimeout(r, 1000))
    setupJustCompleted.current = true
    setNeedsSetup(false)
    setSettingUp(false)
  }

  async function broadcastReaction(emoji: string) {
    if (!game?.id) return
    const { getSupabase } = require('@/lib/supabase')
    const supabase = getSupabase()
    await supabase.channel(`game-reactions:${game.id}`).send({
      type: 'broadcast',
      event: 'react',
      payload: { emoji },
    })
  }

  async function handleTap(side: 'a' | 'b') {
    if (game?.status !== 'live') return
    if (pointSelector === side) {
      setPointSelector(null)
      setSelectedScorer(null)
    } else {
      setPointSelector(side)
      setSelectedScorer(null)
    }
  }

  async function scorePoints(side: 'a' | 'b', points: 1 | 2 | 3) {
    const isWalkIn = selectedScorer?.startsWith('walkin_') ?? false
    const isParticipant = selectedScorer && !isWalkIn && players.some(p => p.id === selectedScorer)
    const isTypedName = selectedScorer && !isWalkIn && !isParticipant
    const participantId = isParticipant ? selectedScorer : undefined
    const scorerName = isWalkIn
      ? players.find(p => p.id === selectedScorer)?.name ?? undefined
      : isTypedName
      ? selectedScorer
      : undefined
    await actions.addScore(side, points, participantId ?? undefined, scorerName)
    setLastScored(side)
    setPointSelector(null)
    setSelectedScorer(null)
    setTimeout(() => setLastScored(null), 600)
  }

  const recentEvents = [...scoreEvents].reverse().filter(e => !e.voided).slice(0, 5)

  useEffect(() => {
    if (game?.status === 'complete' && game.id && !commentaryFetched) {
      setCommentaryFetched(true)
      setCommentaryLoading(true)
      fetch(`/api/runs/${runId}/games/${game.id}/commentary`, { method: 'POST' })
        .then(r => r.json())
        .then(d => { if (d.body) setCommentary(d.body) })
        .catch(() => {})
        .finally(() => setCommentaryLoading(false))
    }
  }, [game?.status, game?.id, commentaryFetched, runId])

  if (state.loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <div className="text-white/40 text-lg">Loading...</div>
      </main>
    )
  }

  // Setup screen
  if (needsSetup && isOrganizer) {
    const unassigned = players.filter(p => !teamAssignments[p.id])
    const teamAPlayers = players.filter(p => teamAssignments[p.id] === 'a')
    const teamBPlayers = players.filter(p => teamAssignments[p.id] === 'b')

    return (
      <main className="min-h-dvh flex flex-col p-5 max-w-lg mx-auto overflow-y-auto pb-10">
        <div className="pt-4 mb-5">
          <div className="text-3xl mb-2">🏀</div>
          <h1 className="text-2xl font-black text-white">Set Up Game</h1>
          <p className="text-white/40 text-sm mt-1">Name teams · assign players · start scoring</p>
        </div>

        {/* Team name inputs */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label className="text-green-400 text-xs uppercase tracking-wider mb-1 block">Team A</label>
            <input
              value={teamAName}
              onChange={e => setTeamAName(e.target.value)}
              placeholder="Skins"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5
                         text-white placeholder:text-white/30 focus:outline-none
                         focus:border-green-400 text-sm"
            />
          </div>
          <div>
            <label className="text-orange-400 text-xs uppercase tracking-wider mb-1 block">Team B</label>
            <input
              value={teamBName}
              onChange={e => setTeamBName(e.target.value)}
              placeholder="Shirts"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5
                         text-white placeholder:text-white/30 focus:outline-none
                         focus:border-orange-400 text-sm"
            />
          </div>
        </div>

        {/* Walk-in add */}
        <div className="mb-5">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Add walk-in</p>
          <div className="flex gap-2">
            <input
              value={walkInName}
              onChange={e => setWalkInName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addWalkIn()}
              placeholder="Name"
              className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2.5
                         text-white placeholder:text-white/30 focus:outline-none
                         focus:border-orange-500 text-sm"
            />
            <button
              onClick={addWalkIn}
              disabled={!walkInName.trim()}
              className="px-4 py-2.5 rounded-xl bg-orange-500 text-white font-bold text-sm
                         active:scale-95 transition-transform disabled:opacity-30"
            >
              + Add
            </button>
          </div>
        </div>

        {/* Player assignment */}
        {players.length > 0 && (
          <div className="mb-6">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-3">
              Tap to assign → <span className="text-green-400">{teamAName || 'A'}</span> → <span className="text-orange-400">{teamBName || 'B'}</span> → unassigned
            </p>

            {/* Team A */}
            {teamAPlayers.length > 0 && (
              <div className="mb-3">
                <p className="text-green-400 text-xs font-semibold mb-2">
                  {teamAName || 'Team A'} · {teamAPlayers.length}
                </p>
                <div className="flex flex-wrap gap-2">
                  {teamAPlayers.map(p => (
                    <button
                      key={p.id}
                      onClick={() => toggleAssignment(p.id)}
                      className="px-3 py-1.5 rounded-xl text-sm font-semibold
                                 bg-green-500/20 text-green-300 border border-green-500/40
                                 active:scale-95 transition-transform"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Team B */}
            {teamBPlayers.length > 0 && (
              <div className="mb-3">
                <p className="text-orange-400 text-xs font-semibold mb-2">
                  {teamBName || 'Team B'} · {teamBPlayers.length}
                </p>
                <div className="flex flex-wrap gap-2">
                  {teamBPlayers.map(p => (
                    <button
                      key={p.id}
                      onClick={() => toggleAssignment(p.id)}
                      className="px-3 py-1.5 rounded-xl text-sm font-semibold
                                 bg-orange-500/20 text-orange-300 border border-orange-500/40
                                 active:scale-95 transition-transform"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Unassigned */}
            {unassigned.length > 0 && (
              <div className="mb-3">
                <p className="text-white/30 text-xs font-semibold mb-2">
                  Unassigned · {unassigned.length}
                </p>
                <div className="flex flex-wrap gap-2">
                  {unassigned.map(p => (
                    <button
                      key={p.id}
                      onClick={() => toggleAssignment(p.id)}
                      className="px-3 py-1.5 rounded-xl text-sm font-semibold
                                 bg-white/10 text-white/50 border border-white/10
                                 active:scale-95 transition-transform"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Team summary */}
        <div className="card p-3 mb-5 flex gap-4">
          <div className="flex-1 text-center">
            <div className="text-green-400 text-2xl font-black">{teamAPlayers.length}</div>
            <div className="text-white/40 text-xs">{teamAName || 'Team A'}</div>
          </div>
          <div className="w-px bg-white/10" />
          <div className="flex-1 text-center">
            <div className="text-orange-400 text-2xl font-black">{teamBPlayers.length}</div>
            <div className="text-white/40 text-xs">{teamBName || 'Team B'}</div>
          </div>
          <div className="w-px bg-white/10" />
          <div className="flex-1 text-center">
            <div className="text-white/30 text-2xl font-black">{unassigned.length}</div>
            <div className="text-white/40 text-xs">Bench</div>
          </div>
        </div>

        <div className="mb-4">
          {!showStartScore ? (
            <button
              onClick={() => setShowStartScore(true)}
              className="text-white/30 text-sm underline"
            >
              + Joining mid-game? Set starting score
            </button>
          ) : (
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Starting Score</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-green-400 text-xs mb-1 block">{teamAName || 'Team A'}</label>
                  <input
                    type="number"
                    min={0}
                    value={startScoreA}
                    onChange={e => setStartScoreA(Number(e.target.value))}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5
                               text-white text-center text-lg font-bold focus:outline-none
                               focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="text-orange-400 text-xs mb-1 block">{teamBName || 'Team B'}</label>
                  <input
                    type="number"
                    min={0}
                    value={startScoreB}
                    onChange={e => setStartScoreB(Number(e.target.value))}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5
                               text-white text-center text-lg font-bold focus:outline-none
                               focus:border-orange-400"
                  />
                </div>
              </div>
              {(startScoreA > 0 || startScoreB > 0) && (
                <p className="text-white/30 text-xs mt-2 text-center">
                  ✓ Will start at {startScoreA}–{startScoreB}
                </p>
              )}
            </div>
          )}
        </div>

        <button
          onClick={setupGame}
          disabled={settingUp}
          className="w-full py-4 rounded-2xl font-bold text-lg bg-orange-500 text-white
                     active:scale-95 transition-transform disabled:opacity-50"
        >
          {settingUp ? 'Setting up...' : 'Start Scoring →'}
        </button>
      </main>
    )
  }

  if (needsSetup && !isOrganizer) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h1 className="text-xl font-bold text-white mb-2">Game not started yet</h1>
        <p className="text-white/50 text-sm">Waiting for the organizer to start the game.</p>
      </main>
    )
  }

  return (
    <main className="min-h-dvh flex flex-col select-none" style={{ touchAction: 'manipulation' }}>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button
          onClick={() => router.push(`/run/${runId}`)}
          className="text-white/40 text-sm"
        >
          ← Run
        </button>
        <div className={cn(
          'text-xs font-semibold px-3 py-1 rounded-full',
          game?.status === 'live' ? 'bg-green-500/20 text-green-400' :
          game?.status === 'contested' ? 'bg-red-500/20 text-red-400' :
          game?.status === 'pre_game' ? 'bg-white/10 text-white/40' :
          'bg-white/10 text-white/40'
        )}>
          {game?.status === 'live' ? '● LIVE' :
           game?.status === 'contested' ? '⚠ DISPUTED' :
           game?.status === 'pre_game' ? 'NOT STARTED' :
           game?.status === 'complete' ? 'FINAL' : ''}
        </div>
        <div className="text-white/40 text-sm">
          G{game?.sequence_number ?? 1}
        </div>
      </div>

      {/* Score Display */}
      <div className="flex-1 flex flex-col">
        <div className="flex h-[55vh]">

          {/* Team A tap zone */}
          <button
            className={cn(
              'flex-1 flex flex-col items-center justify-center relative transition-all duration-150',
              'active:opacity-80',
              game?.status === 'live' ? 'cursor-pointer' : 'cursor-default',
              lastScored === 'a' ? 'bg-green-500/10' : ''
            )}
            onClick={() => handleTap('a')}
            disabled={game?.status !== 'live'}
          >
            <div className="text-white/50 text-sm font-semibold mb-2 uppercase tracking-wider">
              {teamA?.name ?? 'Team A'}
            </div>
            <div className={cn(
              'text-[7rem] font-black leading-none transition-all duration-150',
              'text-green-400',
              lastScored === 'a' ? 'scale-110' : 'scale-100'
            )}>
              {game?.score_a ?? 0}
            </div>
            {game?.status === 'live' && (
              <div className="mt-4 text-white/20 text-xs">TAP TO SCORE</div>
            )}
          </button>

          {/* Divider */}
          <div className="flex flex-col items-center justify-center px-2">
            <div className="text-white/20 text-3xl font-thin">|</div>
          </div>

          {/* Team B tap zone */}
          <button
            className={cn(
              'flex-1 flex flex-col items-center justify-center relative transition-all duration-150',
              'active:opacity-80',
              game?.status === 'live' ? 'cursor-pointer' : 'cursor-default',
              lastScored === 'b' ? 'bg-orange-500/10' : ''
            )}
            onClick={() => handleTap('b')}
            disabled={game?.status !== 'live'}
          >
            <div className="text-white/50 text-sm font-semibold mb-2 uppercase tracking-wider">
              {teamB?.name ?? 'Team B'}
            </div>
            <div className={cn(
              'text-[7rem] font-black leading-none transition-all duration-150',
              'text-orange-400',
              lastScored === 'b' ? 'scale-110' : 'scale-100'
            )}>
              {game?.score_b ?? 0}
            </div>
            {game?.status === 'live' && (
              <div className="mt-4 text-white/20 text-xs">TAP TO SCORE</div>
            )}
          </button>
        </div>

        {/* Point selector overlay */}
        {pointSelector && (() => {
          const sideColor = pointSelector === 'a' ? 'green' : 'orange'
          const sidePlayers = players.filter(p =>
            teamAssignments[p.id] === pointSelector
          )
          return (
            <div className="px-4 py-3 bg-white/5 border-t border-white/10">
              {/* Player chips or free-text */}
              <div className="mb-3">
                <p className="text-white/30 text-xs text-center mb-2 uppercase tracking-wider">
                  Who scored? (optional)
                </p>
                {sidePlayers.length > 0 ? (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {sidePlayers.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedScorer(prev => prev === p.id ? null : p.id)}
                        className={cn(
                          'px-3 py-1.5 rounded-xl text-sm font-semibold transition-all active:scale-95',
                          selectedScorer === p.id
                            ? pointSelector === 'a'
                              ? 'bg-green-500 text-white'
                              : 'bg-orange-500 text-white'
                            : 'bg-white/10 text-white/60 border border-white/10'
                        )}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={selectedScorer ?? ''}
                    onChange={e => setSelectedScorer(e.target.value || null)}
                    placeholder="Type a name..."
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5
                               text-white placeholder:text-white/30 focus:outline-none text-sm
                               focus:border-orange-400 text-center"
                  />
                )}
              </div>
              {/* Points */}
              <p className="text-white/40 text-xs text-center mb-2 uppercase tracking-wider">
                {selectedScorer
                  ? `${players.find(p => p.id === selectedScorer)?.name ?? selectedScorer} scored...`
                  : 'How many points?'}
              </p>
              <div className="flex gap-3">
                {([1, 2, 3] as const).map(pts => (
                  <button
                    key={pts}
                    onClick={() => scorePoints(pointSelector, pts)}
                    className={cn(
                      'flex-1 py-4 rounded-2xl font-black text-2xl',
                      'active:scale-95 transition-transform',
                      pointSelector === 'a'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    )}
                  >
                    {pts}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setPointSelector(null); setSelectedScorer(null) }}
                className="w-full mt-2 py-2 text-white/30 text-sm"
              >
                Cancel
              </button>
            </div>
          )
        })()}

        {/* DEBUG */}
        <div className="px-4 py-2 bg-red-900/40 text-xs text-white/60 font-mono">
          org:{isOrganizer?'Y':'N'} status:{game?.status??'null'} setup:{needsSetup?'Y':'N'} token:{shareToken?shareToken.slice(0,6):'null'}
        </div>

        {/* Controls */}
        <div className="px-4 py-3 border-t border-white/10 space-y-2">

          {/* Organizer controls */}
          {isOrganizer && (
            <div className="flex gap-2">
              {game?.status === 'pre_game' && (
                <button
                  onClick={actions.startGame}
                  className="flex-1 py-3 rounded-xl bg-green-500 text-white font-bold"
                >
                  Start Game
                </button>
              )}
              {game?.status === 'live' && (
                <>
                  <button
                    onClick={actions.undo}
                    className="flex-1 py-3 rounded-xl bg-white/10 text-white font-semibold border border-white/20"
                  >
                    ↩ Undo
                  </button>
                  <button
                    onClick={actions.flagDispute}
                    className="py-3 px-4 rounded-xl bg-red-500/20 text-red-400 font-semibold border border-red-500/20"
                  >
                    ⚠
                  </button>
                  <button
                    onClick={async () => {
                      if (game?.score_a === game?.score_b) {
                        setTieError(true)
                        setTimeout(() => setTieError(false), 2000)
                        return
                      }
                      await actions.endGame()
                    }}
                    className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-bold"
                  >
                    {tieError ? "It's a tie!" : "End Game"}
                  </button>
                </>
              )}
              {game?.status === 'contested' && (
                <button
                  onClick={actions.resolveDispute}
                  className="flex-1 py-3 rounded-xl bg-green-500 text-white font-bold"
                >
                  ✓ Resolve Dispute
                </button>
              )}
            </div>
          )}

          {/* Non-organizer undo (anyone can undo last tap) */}
          {!isOrganizer && game?.status === 'live' && (
            <button
              onClick={actions.undo}
              className="w-full py-3 rounded-xl bg-white/10 text-white/60 font-semibold border border-white/20"
            >
              ↩ Undo last score
            </button>
          )}

          {/* Game complete */}
          {game?.status === 'complete' && (() => {
            const winnerIsA = game.winner_team_id === game.team_a_id
            const winnerName = winnerIsA ? (teamA?.name ?? 'Team A') : (teamB?.name ?? 'Team B')
            const winnerScore = winnerIsA ? game.score_a : game.score_b
            const loserScore = winnerIsA ? game.score_b : game.score_a

            // duration
            let durationStr = ''
            if (game.started_at && game.ended_at) {
              const mins = Math.round((new Date(game.ended_at).getTime() - new Date(game.started_at).getTime()) / 60000)
              durationStr = `${mins}m`
            }

            // top scorer
            const scorerTotals: Record<string, { name: string; points: number }> = {}
            scoreEvents.filter(e => !e.voided).forEach(e => {
              const key = e.scored_by_player_id ?? e.scorer_name ?? null
              if (!key) return
              const name = e.scorer_name ?? players.find(p => p.id === e.scored_by_player_id)?.name ?? 'Unknown'
              if (!scorerTotals[key]) scorerTotals[key] = { name, points: 0 }
              scorerTotals[key].points += e.points
            })
            const topScorer = Object.values(scorerTotals).sort((a, b) => b.points - a.points)[0] ?? null

            function copyResult() {
              const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
              const lines = [
                `🏀 ${winnerName} wins! ${winnerScore}–${loserScore}`,
                topScorer ? `🔥 Top scorer: ${topScorer.name} (${topScorer.points}pts)` : null,
                durationStr ? `⏱ ${durationStr}` : null,
                `${appUrl}/run/${runId}`,
              ].filter(Boolean)
              navigator.clipboard.writeText(lines.join('\n'))
              setCopiedResult(true)
              setTimeout(() => setCopiedResult(false), 2000)
            }

            return (
              <div className="px-4 py-4 space-y-3">
                <div className="card p-4 text-center border-orange-500/30">
                  <p className="text-orange-400 text-xs uppercase tracking-wider font-semibold mb-1">Final</p>
                  <p className="text-white font-black text-2xl mb-0.5">{winnerName} wins! 🏆</p>
                  <p className="text-white/50 text-4xl font-black">{winnerScore}–{loserScore}</p>
                  <div className="flex justify-center gap-4 mt-3 text-white/30 text-xs">
                    {durationStr && <span>⏱ {durationStr}</span>}
                    {topScorer && <span>🔥 {topScorer.name} · {topScorer.points}pts</span>}
                  </div>
                </div>
                <button
                  onClick={copyResult}
                  className="w-full py-3 rounded-2xl font-bold bg-white/10 text-white border border-white/20 text-sm"
                >
                  {copiedResult ? '✓ Copied!' : '📋 Copy Result'}
                </button>
                {commentaryLoading && (
                  <div className="card p-4 text-center">
                    <p className="text-white/30 text-xs animate-pulse">🎙 Generating commentary...</p>
                  </div>
                )}
                {commentary && !commentaryLoading && (
                  <div className="card p-4 border-white/10">
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-2">🎙 Game Commentary</p>
                    <p className="text-white/80 text-sm leading-relaxed">{commentary}</p>
                  </div>
                )}
                {isOrganizer && (
                  <button
                    onClick={() => {
                        // Carry existing assignments into next game setup
                        // (teamAssignments keyed by participant ID — still valid)
                        setNeedsSetup(true)
                        setTeamAName('Team A')
                        setTeamBName('Team B')
                        setStartScoreA(0)
                        setStartScoreB(0)
                        setShowStartScore(false)
                      }}
                    className="w-full py-3 rounded-2xl font-bold bg-orange-500 text-white text-sm"
                  >
                    Next game →
                  </button>
                )}
              </div>
            )
          })()}
        </div>

        {/* Score log */}
        {recentEvents.length > 0 && (
          <div className="px-4 py-3 border-t border-white/5">
            <p className="text-white/20 text-xs uppercase tracking-wider mb-2">Recent</p>
            <div className="space-y-1">
              {recentEvents.map((e, i) => {
                const isA = game && e.team_id === game.team_a_id
                return (
                  <div key={e.id} className="flex items-center gap-2">
                    <div className={cn(
                      'w-2 h-2 rounded-full',
                      isA ? 'bg-green-400' : 'bg-orange-400'
                    )} />
                    <span className={cn(
                      'text-sm',
                      isA ? 'text-green-400' : 'text-orange-400'
                    )}>
                      {isA ? (teamA?.name ?? 'Team A') : (teamB?.name ?? 'Team B')}
                    </span>
                    <span className="text-white/40 text-sm">+{e.points}</span>
                    {e.scorer_name && (
                      <span className="text-white/30 text-xs">{e.scorer_name}</span>
                    )}
                    {!e.scorer_name && e.scored_by_player_id && (
                      <span className="text-white/30 text-xs">
                        {players.find(p => p.id === e.scored_by_player_id)?.name}
                      </span>
                    )}
                    {i === 0 && <span className="text-white/20 text-xs ml-auto">latest</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
      {/* Attribution modal */}
      {showAttribution && game && (
        <div className="fixed inset-0 bg-black/80 flex flex-col justify-end z-50">
          <div className="bg-[#1a1a1a] rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-white font-black text-lg">Who scored?</h2>
                <p className="text-white/40 text-xs mt-0.5">Optional — skip any you don't know</p>
              </div>
              <button
                onClick={() => setShowAttribution(false)}
                className="text-white/30 text-sm px-3 py-1.5 rounded-lg bg-white/10"
              >
                Skip
              </button>
            </div>
            <div className="space-y-3 mb-5">
              {scoreEvents.filter(e => !e.voided).map((e, i) => {
                const isA = e.team_id === game.team_a_id
                return (
                  <div key={e.id} className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isA ? 'bg-green-400' : 'bg-orange-400'}`} />
                    <span className={`text-sm w-16 flex-shrink-0 ${isA ? 'text-green-400' : 'text-orange-400'}`}>
                      +{e.points}pts
                    </span>
                    <input
                      value={scorerNames[e.id] ?? ''}
                      onChange={ev => setScorerNames(s => ({ ...s, [e.id]: ev.target.value }))}
                      placeholder={`Scorer ${i + 1}`}
                      className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2
                                 text-white text-sm placeholder:text-white/20 focus:outline-none
                                 focus:border-orange-500"
                    />
                  </div>
                )
              })}
            </div>
            <button
              onClick={saveAttribution}
              disabled={savingAttribution}
              className="w-full py-3 rounded-2xl font-bold bg-orange-500 text-white disabled:opacity-50"
            >
              {savingAttribution ? 'Saving...' : 'Save Names'}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
