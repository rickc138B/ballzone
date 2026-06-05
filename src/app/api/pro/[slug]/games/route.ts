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

    // Get distinct game dates + team combos — reconstruct "games" from player stats
    // Group by game_date + team_id + opponent_id
    const { data: stats, error } = await supabase
      .from('pro_game_stats')
      .select(`
        id, game_date, pts, reb, ast, stl, blk, tov, fgm, fga, three_pm, three_pa, ftm, fta, minutes,
        player:pro_players(id, name),
        team:pro_teams!pro_game_stats_team_id_fkey(id, name, abbreviation),
        opponent:pro_teams!pro_game_stats_opponent_id_fkey(id, name, abbreviation)
      `)
      .eq('league_id', league.id)
      .order('game_date', { ascending: false })
      .limit(500)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Group into games: key = game_date|team_id|opponent_id (canonical: sort team ids)
    const gamesMap: Record<string, any> = {}

    for (const row of stats ?? []) {
      const team = row.team as any
      const opponent = row.opponent as any
      if (!team || !opponent) continue

      // Canonical key — same regardless of which team's player we're looking at
      const ids = [team.id, opponent.id].sort()
      const key = `${row.game_date}|${ids[0]}|${ids[1]}`

      if (!gamesMap[key]) {
        gamesMap[key] = {
          game_date: row.game_date,
          home_team: team,
          away_team: opponent,
          home_players: [],
          away_players: [],
          // We'll calculate team totals after
        }
      }

      const game = gamesMap[key]
      const isHome = game.home_team.id === team.id
      const playerEntry = {
        id: (row.player as any)?.id,
        name: (row.player as any)?.name,
        pts: row.pts, reb: row.reb, ast: row.ast,
        stl: row.stl, blk: row.blk, tov: row.tov,
        fgm: row.fgm, fga: row.fga,
        three_pm: row.three_pm, three_pa: row.three_pa,
        ftm: row.ftm, fta: row.fta,
        minutes: row.minutes,
      }

      if (isHome) game.home_players.push(playerEntry)
      else game.away_players.push(playerEntry)
    }

    // Calculate team totals and sort players by pts
    const games = Object.values(gamesMap).map((g: any) => {
      const homeScore = g.home_players.reduce((s: number, p: any) => s + (p.pts ?? 0), 0)
      const awayScore = g.away_players.reduce((s: number, p: any) => s + (p.pts ?? 0), 0)
      return {
        ...g,
        home_score: homeScore,
        away_score: awayScore,
        home_players: g.home_players.sort((a: any, b: any) => b.pts - a.pts),
        away_players: g.away_players.sort((a: any, b: any) => b.pts - a.pts),
      }
    })

    return NextResponse.json({ games })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
