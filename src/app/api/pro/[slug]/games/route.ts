import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const supabase = createServiceClient()

    const { data: league } = await supabase
      .from('pro_leagues')
      .select('id')
      .eq('slug', slug)
      .single()

    if (!league) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Get real games with real scores
    const { data: games, error } = await supabase
      .from('pro_games')
      .select(`
        id, game_date, home_score, away_score, status,
        home_team:pro_teams!pro_games_home_team_id_fkey(id, name, abbreviation),
        away_team:pro_teams!pro_games_away_team_id_fkey(id, name, abbreviation)
      `)
      .eq('league_id', league.id)
      .not('home_team_id', 'is', null)
      .not('away_team_id', 'is', null)
      .not('home_score', 'is', null)
      .order('game_date', { ascending: false })
      .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // For each game, get top performers from pro_game_stats
    const allGameIds = games?.map(g => g.id) ?? []

    // Fetch player stats by game_id in one query
    const { data: stats } = await supabase
      .from('pro_game_stats')
      .select(`
        game_id, team_id, pts, reb, ast, stl, blk, tov,
        fgm, fga, three_pm, three_pa, ftm, fta, minutes,
        player:pro_players(id, name)
      `)
      .eq('league_id', league.id)
      .in('game_id', allGameIds)
      .order('pts', { ascending: false })

    // Group stats by game_id+team_id
    const statsByGameTeam: Record<string, any[]> = {}
    for (const s of stats ?? []) {
      const key = `${s.game_id}|${s.team_id}`
      if (!statsByGameTeam[key]) statsByGameTeam[key] = []
      statsByGameTeam[key].push(s)
    }

    const result = games?.map(g => {
      const homeTeam = g.home_team as any
      const awayTeam = g.away_team as any
      const homePlayers = statsByGameTeam[`${g.id}|${homeTeam?.id}`] ?? []
      const awayPlayers = statsByGameTeam[`${g.id}|${awayTeam?.id}`] ?? []

      return {
        id: g.id,
        game_date: g.game_date,
        home_team: homeTeam,
        away_team: awayTeam,
        home_score: g.home_score,
        away_score: g.away_score,
        home_players: homePlayers.slice(0, 8).map((p: any) => ({
          id: p.player?.id,
          name: p.player?.name,
          pts: p.pts, reb: p.reb, ast: p.ast,
          stl: p.stl, blk: p.blk, tov: p.tov,
          fgm: p.fgm, fga: p.fga,
          three_pm: p.three_pm, three_pa: p.three_pa,
          ftm: p.ftm, fta: p.fta,
          minutes: p.minutes,
        })),
        away_players: awayPlayers.slice(0, 8).map((p: any) => ({
          id: p.player?.id,
          name: p.player?.name,
          pts: p.pts, reb: p.reb, ast: p.ast,
          stl: p.stl, blk: p.blk, tov: p.tov,
          fgm: p.fgm, fga: p.fga,
          three_pm: p.three_pm, three_pa: p.three_pa,
          ftm: p.ftm, fta: p.fta,
          minutes: p.minutes,
        })),
      }
    }) ?? []

    return NextResponse.json({ games: result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
