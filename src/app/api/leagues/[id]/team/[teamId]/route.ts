import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const { id: leagueId, teamId } = await params
    const supabase = createServiceClient()

    const { data: team, error } = await supabase
      .from('league_teams')
      .select('id, name')
      .eq('id', teamId)
      .eq('league_id', leagueId)
      .single()

    if (error || !team) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: players } = await supabase
      .from('league_players')
      .select('id, display_name, photo_url, profile_id')
      .eq('league_team_id', teamId)
      .order('display_name')

    const { data: games } = await supabase
      .from('league_games')
      .select(`
        id, round_label, played_at, home_score, away_score, status,
        home_team:league_teams!league_games_home_team_id_fkey(id, name),
        away_team:league_teams!league_games_away_team_id_fkey(id, name)
      `)
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .eq('league_id', leagueId)
      .eq('status', 'complete')
      .order('played_at', { ascending: false })

    const record = { w: 0, l: 0, gp: 0, pts_for: 0, pts_against: 0 }
    const gameSummaries = (games ?? []).map(g => {
      const isHome = (g.home_team as any)?.id === teamId
      const team_score = isHome ? g.home_score : g.away_score
      const opp_score = isHome ? g.away_score : g.home_score
      const opponent = isHome ? (g.away_team as any)?.name : (g.home_team as any)?.name
      const won = team_score > opp_score
      record.gp++
      record.pts_for += team_score ?? 0
      record.pts_against += opp_score ?? 0
      if (won) record.w++
      else record.l++
      return { id: g.id, round_label: g.round_label, played_at: g.played_at, opponent, team_score, opp_score, won }
    })

    return NextResponse.json({
      team,
      players: (players ?? []).map(p => ({ ...p, is_claimed: !!p.profile_id })),
      record,
      games: gameSummaries,
    })
  } catch (err) {
    console.error('team route error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
