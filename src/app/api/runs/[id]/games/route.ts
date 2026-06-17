import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()

    const { data: games, error } = await supabase
      .from('games')
      .select(`
        id,
        sequence_number,
        score_a,
        score_b,
        winner_team_id,
        started_at,
        ended_at,
        team_a:run_teams!games_team_a_id_fkey(id, name),
        team_b:run_teams!games_team_b_id_fkey(id, name)
      `)
      .eq('session_id', id)
      .eq('status', 'complete')
      .order('sequence_number', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const formatted = (games ?? []).map(g => {
      const durationMs =
        g.started_at && g.ended_at
          ? new Date(g.ended_at).getTime() - new Date(g.started_at).getTime()
          : null
      const durationMin = durationMs ? Math.round(durationMs / 60000) : null
      const teamA = g.team_a as unknown as { id: string; name: string } | null
      const teamB = g.team_b as unknown as { id: string; name: string } | null

      const teams = [
        { id: teamA?.id ?? '', name: teamA?.name ?? 'Team A', score: g.score_a ?? 0 },
        { id: teamB?.id ?? '', name: teamB?.name ?? 'Team B', score: g.score_b ?? 0 },
      ].sort((a, b) => b.score - a.score)

      return {
        id: g.id,
        sequence_number: g.sequence_number,
        winner_team_id: g.winner_team_id,
        duration_min: durationMin,
        teams,
      }
    })

    return NextResponse.json(formatted)
  } catch (err) {
    console.error('GET games error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const shareToken = req.headers.get('x-share-token')
    if (!shareToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Verify share token
    const { data: run } = await supabase
      .from('runs')
      .select('id, share_token')
      .eq('id', id)
      .single()

    if (!run || run.share_token !== shareToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { teamAName, teamBName, startScoreA = 0, startScoreB = 0 } = body

    // Create teams
    const { data: teamARow } = await supabase
      .from('run_teams')
      .insert({ session_id: id, name: teamAName, color: '#22c55e', status: 'on_court' })
      .select().single()

    const { data: teamBRow } = await supabase
      .from('run_teams')
      .insert({ session_id: id, name: teamBName, color: '#f97316', status: 'on_court' })
      .select().single()

    if (!teamARow || !teamBRow) {
      return NextResponse.json({ error: 'Failed to create teams' }, { status: 500 })
    }

    // Ensure session exists
    await supabase.from('sessions').upsert(
      { id, run_id: id, status: 'active' },
      { onConflict: 'id' }
    )

    // Clean up any orphaned live 0-0 games before creating new one
    const { data: orphans } = await supabase
      .from('games')
      .select('id')
      .eq('session_id', id)
      .eq('status', 'live')
      .eq('score_a', 0)
      .eq('score_b', 0)
    if (orphans && orphans.length > 0) {
      await supabase
        .from('games')
        .update({ status: 'complete', ended_at: new Date().toISOString() })
        .in('id', orphans.map(g => g.id))
    }

    // Get next sequence number
    const { data: games } = await supabase
      .from('games')
      .select('sequence_number')
      .eq('session_id', id)
      .order('sequence_number', { ascending: false })
      .limit(1)

    const nextSeq = (games?.[0]?.sequence_number ?? 0) + 1

    // Create game
    const { data: newGame } = await supabase.from('games').insert({
      session_id: id,
      sequence_number: nextSeq,
      team_a_id: teamARow.id,
      team_b_id: teamBRow.id,
      status: 'live',
      started_at: new Date().toISOString(),
      score_a: startScoreA,
      score_b: startScoreB,
    }).select().single()

    if (!newGame) {
      return NextResponse.json({ error: 'Failed to create game' }, { status: 500 })
    }

    // Add starting score event if mid-game join
    if (startScoreA > 0 || startScoreB > 0) {
      await supabase.from('score_events').insert({
        game_id: newGame.id,
        team_id: teamARow.id,
        points: 0,
        scorer_name: '↩ Joined at ' + startScoreA + '–' + startScoreB,
        voided: false,
      })
    }

    return NextResponse.json({ game: newGame, teamA: teamARow, teamB: teamBRow })
  } catch (err) {
    console.error('POST games error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
