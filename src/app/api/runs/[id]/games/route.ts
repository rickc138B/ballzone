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
