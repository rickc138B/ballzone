import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: runId } = await params
    const shareToken = req.headers.get('x-share-token')
    if (!shareToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Verify organizer
    const { data: run } = await supabase
      .from('runs')
      .select('id, share_token')
      .eq('id', runId)
      .single()

    if (!run || run.share_token !== shareToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { team_a_name, team_b_name, score_a, score_b, players, events } = await req.json()

    if (score_a === score_b) {
      return NextResponse.json({ error: 'Tied games cannot be saved' }, { status: 400 })
    }

    // Ensure session exists
    await supabase.from('sessions').upsert(
      { id: runId, run_id: runId, status: 'active' },
      { onConflict: 'id' }
    )

    // Get next sequence number
    const { data: existing } = await supabase
      .from('games')
      .select('sequence_number')
      .eq('session_id', runId)
      .order('sequence_number', { ascending: false })
      .limit(1)

    const nextSeq = (existing?.[0]?.sequence_number ?? 0) + 1

    // Create teams
    const { data: teamA } = await supabase
      .from('run_teams')
      .insert({ session_id: runId, name: team_a_name || 'Team A', color: '#22c55e', status: 'on_court' })
      .select().single()

    const { data: teamB } = await supabase
      .from('run_teams')
      .insert({ session_id: runId, name: team_b_name || 'Team B', color: '#f97316', status: 'on_court' })
      .select().single()

    if (!teamA || !teamB) {
      return NextResponse.json({ error: 'Failed to create teams' }, { status: 500 })
    }

    const winnerId = score_a > score_b ? teamA.id : teamB.id
    const now = new Date()
    const startedAt = new Date(now.getTime() - 20 * 60 * 1000).toISOString() // assume 20min game

    // Create game
    const { data: game } = await supabase
      .from('games')
      .insert({
        session_id: runId,
        sequence_number: nextSeq,
        team_a_id: teamA.id,
        team_b_id: teamB.id,
        score_a,
        score_b,
        status: 'complete',
        started_at: startedAt,
        ended_at: now.toISOString(),
        winner_team_id: winnerId,
      })
      .select().single()

    if (!game) {
      return NextResponse.json({ error: 'Failed to create game' }, { status: 500 })
    }

    // Insert score events if provided
    if (events && events.length > 0) {
      const totalEvents = events.length
      const eventRows = events.map((e: { team: 'a' | 'b'; points: number; scorer: string }, i: number) => {
        const teamId = e.team === 'a' ? teamA.id : teamB.id
        // spread events evenly across the game duration
        const offset = Math.round((i / totalEvents) * 20 * 60 * 1000)
        return {
          game_id: game.id,
          team_id: teamId,
          points: e.points,
          scorer_name: e.scorer || null,
          timestamp: new Date(new Date(startedAt).getTime() + offset).toISOString(),
          voided: false,
        }
      })
      await supabase.from('score_events').insert(eventRows)
    }

    // Mark run as completed if not already
    await supabase
      .from('runs')
      .update({ status: 'completed' })
      .eq('id', runId)
      .in('status', ['open', 'active'])

    return NextResponse.json({ game_id: game.id, sequence_number: nextSeq })
  } catch (err) {
    console.error('Backfill error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
