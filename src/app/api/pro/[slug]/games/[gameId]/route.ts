import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; gameId: string }> }
) {
  try {
    const { slug, gameId } = await params
    const supabase = createServiceClient()

    const { data: league } = await supabase
      .from('pro_leagues')
      .select('id')
      .eq('slug', slug)
      .single()

    if (!league) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: game, error } = await supabase
      .from('pro_games')
      .select(`
        id, game_date, home_score, away_score, status,
        home_team:pro_teams!pro_games_home_team_id_fkey(id, name, abbreviation),
        away_team:pro_teams!pro_games_away_team_id_fkey(id, name, abbreviation)
      `)
      .eq('id', gameId)
      .eq('league_id', league.id)
      .single()

    if (error || !game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })

    const homeTeam = game.home_team as any
    const awayTeam = game.away_team as any

    const { data: stats } = await supabase
      .from('pro_game_stats')
      .select(`
        team_id, pts, reb, ast, stl, blk, tov,
        fgm, fga, three_pm, three_pa, ftm, fta, minutes,
        player:pro_players(id, name)
      `)
      .eq('league_id', league.id)
      .eq('game_id', gameId)
      .in('team_id', [homeTeam.id, awayTeam.id])
      .order('pts', { ascending: false })

    const mapPlayer = (s: any) => ({
      id: s.player?.id,
      name: s.player?.name,
      pts: s.pts, reb: s.reb, ast: s.ast,
      stl: s.stl, blk: s.blk, tov: s.tov,
      fgm: s.fgm, fga: s.fga,
      three_pm: s.three_pm, three_pa: s.three_pa,
      ftm: s.ftm, fta: s.fta,
      minutes: s.minutes,
    })

    const homePlayers = (stats ?? []).filter(s => s.team_id === homeTeam.id).map(mapPlayer)
    const awayPlayers = (stats ?? []).filter(s => s.team_id === awayTeam.id).map(mapPlayer)

    return NextResponse.json({
      game: {
        id: game.id,
        game_date: game.game_date,
        status: game.status,
        home_team: homeTeam,
        away_team: awayTeam,
        home_score: game.home_score,
        away_score: game.away_score,
        home_players: homePlayers,
        away_players: awayPlayers,
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
