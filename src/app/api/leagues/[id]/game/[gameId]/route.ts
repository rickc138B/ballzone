import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  try {
    const { gameId } = await params
    const supabase = createServiceClient()

    const { data: game, error } = await supabase
      .from('league_games')
      .select(`
        id, round_label, played_at, location_name, home_score, away_score,
        home_team:league_teams!league_games_home_team_id_fkey(id, name),
        away_team:league_teams!league_games_away_team_id_fkey(id, name)
      `)
      .eq('id', gameId)
      .single()

    if (error || !game) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: stats } = await supabase
      .from('player_game_stats')
      .select(`
        id, league_team_id, pts, reb, ast, blk, stl, tov, fga, fgm, three_pa, three_pm, fta, ftm,
        player:league_players!player_game_stats_league_player_id_fkey(id, display_name)
      `)
      .eq('league_game_id', gameId)

    const homeId = (game.home_team as any)?.id
    const awayId = (game.away_team as any)?.id

    function mapStats(teamId: string) {
      return (stats ?? [])
        .filter(s => s.league_team_id === teamId)
        .map(s => ({
          id: (s.player as any)?.id,
          display_name: (s.player as any)?.display_name ?? 'Unknown',
          pts: s.pts, reb: s.reb, ast: s.ast, blk: s.blk, stl: s.stl, tov: s.tov,
          fga: s.fga, fgm: s.fgm, three_pa: s.three_pa, three_pm: s.three_pm, fta: s.fta, ftm: s.ftm,
        }))
    }

    return NextResponse.json({
      id: game.id,
      round_label: game.round_label,
      played_at: game.played_at,
      location_name: game.location_name,
      home_team: { id: homeId, name: (game.home_team as any)?.name, score: game.home_score, players: mapStats(homeId) },
      away_team: { id: awayId, name: (game.away_team as any)?.name, score: game.away_score, players: mapStats(awayId) },
    })
  } catch (err) {
    console.error('GET league game error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
