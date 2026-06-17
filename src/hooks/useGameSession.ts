'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getSupabase } from '@/lib/supabase'
import type { Game, RunTeam, ScoreEvent } from '@/lib/types'

export interface GameState {
  game: Game | null
  teamA: RunTeam | null
  teamB: RunTeam | null
  scoreEvents: ScoreEvent[]
  loading: boolean
  error: string | null
}

export interface GameActions {
  addScore: (teamSide: 'a' | 'b', points: 0 | 1 | 2 | 3, scorerParticipantId?: string, scorerName?: string, eventType?: string) => Promise<void>
  undo: () => Promise<void>
  flagDispute: () => Promise<void>
  resolveDispute: () => Promise<void>
  startGame: () => Promise<void>
  endGame: () => Promise<void>
}

export function useGameSession(sessionId: string, shareToken: string | null) {
  const [state, setState] = useState<GameState>({
    game: null, teamA: null, teamB: null, scoreEvents: [], loading: true, error: null,
  })
  const gameIdRef = useRef<string | null>(null)
  const gameRef = useRef<typeof state.game>(null)
  const gameSeqRef = useRef<number>(0)
  const gameStatusRef = useRef<string | null>(null)

  const fetchGame = useCallback(async () => {
    const supabase = getSupabase()
    const { data: games } = await supabase
      .from('games')
      .select('*, team_a:run_teams!games_team_a_id_fkey(*), team_b:run_teams!games_team_b_id_fkey(*)')
      .eq('session_id', sessionId)
      .order('sequence_number', { ascending: false })
      .limit(1)

    if (!games || games.length === 0) {
      // Don't reset state if we already have a game loaded
      setState(s => s.game ? s : { ...s, loading: false })
      return
    }
    const game = games[0]
    // Don't overwrite a live game with an older/different game
    const currentGameId = gameIdRef.current
    if (currentGameId && currentGameId !== game.id) {
      // Don't overwrite a live game with an older/same sequence game
      if (gameStatusRef.current === 'live' && game.sequence_number <= gameSeqRef.current) return
    }
    gameIdRef.current = game.id
    gameSeqRef.current = game.sequence_number
    gameStatusRef.current = game.status

    const { data: events } = await supabase
      .from('score_events')
      .select('*')
      .eq('game_id', game.id)
      .order('timestamp', { ascending: true })

    setState({
      game,
      teamA: game.team_a,
      teamB: game.team_b,
      scoreEvents: events ?? [],
      loading: false,
      error: null,
    })
  }, [sessionId])

  useEffect(() => {
    fetchGame()
    const supabase = getSupabase()
    const channel = supabase
      .channel(`session:${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `session_id=eq.${sessionId}` }, () => fetchGame())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'score_events' }, (payload) => {
        if (payload.new.game_id === gameIdRef.current) {
          setState(s => ({ ...s, scoreEvents: [...s.scoreEvents, payload.new as ScoreEvent] }))
          fetchGame()
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'score_events' }, () => fetchGame())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [sessionId, fetchGame])

  const addScore = useCallback(async (teamSide: 'a' | 'b', points: 0 | 1 | 2 | 3, scorerParticipantId?: string, scorerName?: string, eventType: string = 'score') => {
    const currentGame = gameRef.current ?? state.game
    if (!currentGame || currentGame.status !== 'live') return
    const teamId = teamSide === 'a' ? currentGame.team_a_id : currentGame.team_b_id
    const supabase = getSupabase()

    // Optimistic update first
    if (points > 0) {
      setState(s => ({
        ...s,
        game: s.game ? {
          ...s.game,
          score_a: teamSide === 'a' ? s.game.score_a + points : s.game.score_a,
          score_b: teamSide === 'b' ? s.game.score_b + points : s.game.score_b,
        } : null,
      }))
    }

    await supabase.from('score_events').insert({
      game_id: (gameRef.current ?? state.game)!.id,
      team_id: teamId,
      points,
      scored_by_player_id: scorerParticipantId ?? null,
      scorer_name: scorerName ?? null,
      event_type: eventType,
    })
  }, [state.game])

  const undo = useCallback(async () => {
    if (!state.game) return
    const lastEvent = [...state.scoreEvents].reverse().find(e => !e.voided)
    if (!lastEvent) return
    const supabase = getSupabase()

    // Optimistic update
    setState(s => ({
      ...s,
      game: s.game ? {
        ...s.game,
        score_a: lastEvent.team_id === s.game?.team_a_id ? s.game.score_a - lastEvent.points : s.game.score_a,
        score_b: lastEvent.team_id === s.game?.team_b_id ? s.game.score_b - lastEvent.points : s.game.score_b,
      } : null,
      scoreEvents: s.scoreEvents.map(e => e.id === lastEvent.id ? { ...e, voided: true } : e),
    }))

    await supabase
      .from('score_events')
      .update({ voided: true, voided_at: new Date().toISOString() })
      .eq('id', lastEvent.id)
  }, [state.game, state.scoreEvents])

  const flagDispute = useCallback(async () => {
    if (!state.game) return
    const supabase = getSupabase()
    await supabase.from('games').update({ status: 'contested' }).eq('id', state.game.id)
    setState(s => ({ ...s, game: s.game ? { ...s.game, status: 'contested' } : null }))
  }, [state.game])

  const resolveDispute = useCallback(async () => {
    if (!state.game) return
    const supabase = getSupabase()
    await supabase.from('games').update({ status: 'live' }).eq('id', state.game.id)
    setState(s => ({ ...s, game: s.game ? { ...s.game, status: 'live' } : null }))
  }, [state.game])

  const startGame = useCallback(async () => {
    if (!state.game) return
    const supabase = getSupabase()
    await supabase.from('games').update({ status: 'live', started_at: new Date().toISOString() }).eq('id', state.game.id)
    setState(s => ({ ...s, game: s.game ? { ...s.game, status: 'live' } : null }))
  }, [state.game])

  const endGame = useCallback(async () => {
    if (!state.game) return
    const { score_a, score_b, team_a_id, team_b_id, session_id } = state.game
    if (score_a === score_b) return
    const winnerId = score_a > score_b ? team_a_id : team_b_id
    const supabase = getSupabase()
    await supabase.from('games').update({
      status: 'complete',
      ended_at: new Date().toISOString(),
      winner_team_id: winnerId,
    }).eq('id', state.game.id)
    // Fetch final score events so stats show on complete screen
    const { data: finalEvents } = await getSupabase()
      .from('score_events')
      .select('*')
      .eq('game_id', state.game.id)
      .order('timestamp', { ascending: true })
    gameStatusRef.current = 'complete'
    setState(s => ({
      ...s,
      game: s.game ? { ...s.game, status: 'complete', winner_team_id: winnerId } : null,
      scoreEvents: finalEvents ?? s.scoreEvents,
    }))
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'game_completed', run_id: session_id, meta: { score_a, score_b } }),
    }).catch(() => {})
  }, [state.game])

  const hydrateGame = useCallback((game: any, teamA: any, teamB: any) => {
    gameIdRef.current = game.id
    gameSeqRef.current = game.sequence_number
    gameStatusRef.current = game.status
    gameRef.current = game
    setState({
      game, teamA, teamB,
      scoreEvents: [],
      loading: false,
      error: null,
    })
  }, [])

  return { state, actions: { addScore, undo, flagDispute, resolveDispute, startGame, endGame }, fetchGame, hydrateGame }
}
