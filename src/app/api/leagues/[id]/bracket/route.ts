import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leagueId } = await params
    const supabase = createServiceClient()

    const { data: games, error } = await supabase
      .from('league_games')
      .select(`
        id, round_label, bracket_round, bracket_slot,
        played_at, home_score, away_score, status, location_name,
        home_team:league_teams!league_games_home_team_id_fkey(id, name),
        away_team:league_teams!league_games_away_team_id_fkey(id, name)
      `)
      .eq('league_id', leagueId)
      .not('bracket_round', 'is', null)
      .order('bracket_round', { ascending: true })
      .order('bracket_slot', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Group by bracket_round
    const rounds: Record<number, any[]> = {}
    for (const g of games ?? []) {
      const r = g.bracket_round ?? 1
      if (!rounds[r]) rounds[r] = []
      rounds[r].push(g)
    }

    const roundLabels: Record<number, string> = {}
    for (const g of games ?? []) {
      if (g.bracket_round && g.round_label && !roundLabels[g.bracket_round]) {
        roundLabels[g.bracket_round] = g.round_label
      }
    }

    return NextResponse.json({ rounds, roundLabels })
  } catch (err) {
    console.error('bracket error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
