import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; playerId: string }> }
) {
  try {
    const { slug, playerId } = await params
    const supabase = createServiceClient()

    const { data: league } = await supabase
      .from('pro_leagues')
      .select('id')
      .eq('slug', slug)
      .single()

    if (!league) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Player + team
    const { data: player } = await supabase
      .from('pro_players')
      .select('id, name, nationality, photo_url, external_id, current_team_id, team:pro_teams(id, name, abbreviation)')
      .eq('id', playerId)
      .single()

    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

    // Season averages
    const { data: season } = await supabase
      .from('pro_player_seasons')
      .select('pts, reb, ast, stl, blk, games_played, fg_pct, three_pct')
      .eq('player_id', playerId)
      .eq('league_id', league.id)
      .single()

    // Game log — all games this season sorted recent first
    const { data: gameLogs } = await supabase
      .from('pro_game_stats')
      .select('game_date, team_id, pts, reb, ast, stl, blk, tov, fgm, fga, three_pm, three_pa, ftm, fta, minutes, opponent_id, opponent:pro_teams!pro_game_stats_opponent_id_fkey(id, name, abbreviation)')
      .eq('player_id', playerId)
      .eq('league_id', league.id)
      .order('game_date', { ascending: false })
      .limit(100)

    // For each game log entry, get the score from pro_games
    // Match by game_date + teams involved
    const dates = [...new Set((gameLogs ?? []).map(g => g.game_date))]
    const { data: proGames } = await supabase
      .from('pro_games')
      .select('id, game_date, home_team_id, away_team_id, home_score, away_score, home_team:pro_teams!pro_games_home_team_id_fkey(abbreviation), away_team:pro_teams!pro_games_away_team_id_fkey(abbreviation)')
      .eq('league_id', league.id)
      .in('game_date', dates)

    // Build game score lookup by date+team
    const gameByDateTeam: Record<string, any> = {}
    for (const g of proGames ?? []) {
      const ht = g.home_team as any
      const at = g.away_team as any
      gameByDateTeam[`${g.game_date}|${g.home_team_id}`] = g
      gameByDateTeam[`${g.game_date}|${g.away_team_id}`] = g
    }

    const gameLog = (gameLogs ?? []).map(g => {
      const matchedGame = gameByDateTeam[`${g.game_date}|${g.team_id}`]
      const opponent = g.opponent as any
      const homeTeam = matchedGame?.home_team as any
      const awayTeam = matchedGame?.away_team as any
      return {
        game_id: matchedGame?.id ?? null,
        game_date: g.game_date,
        opponent_abbr: opponent?.abbreviation ?? null,
        home_abbr: homeTeam?.abbreviation ?? null,
        away_abbr: awayTeam?.abbreviation ?? null,
        home_score: matchedGame?.home_score ?? null,
        away_score: matchedGame?.away_score ?? null,
        pts: g.pts, reb: g.reb, ast: g.ast,
        stl: g.stl, blk: g.blk, tov: g.tov,
        fgm: g.fgm, fga: g.fga,
        three_pm: g.three_pm, three_pa: g.three_pa,
        ftm: g.ftm, fta: g.fta,
        minutes: g.minutes,
      }
    })

    // Career high
    const careerHigh = gameLog.length
      ? gameLog.reduce((best, g) => g.pts > best.pts ? g : best, gameLog[0])
      : null

    return NextResponse.json({
      player: {
        id: player.id,
        name: player.name,
        nationality: player.nationality,
        photo_url: player.photo_url,
        team: player.team,
      },
      season: season ?? null,
      career_high: careerHigh,
      game_log: gameLog,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
