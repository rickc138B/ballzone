import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

const NBA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://www.nba.com',
  'Accept': 'application/json',
}

export async function POST(req: NextRequest) {
  try {
    const { secret } = await req.json()
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()
    const results: string[] = []

    // Insert NBA league
    await supabase.from('pro_leagues').upsert({
      id: 'nba-2024-25',
      name: 'NBA',
      slug: 'nba',
      region: 'north_america',
      season: '2024-25',
    })
    results.push('League inserted')

    // Fetch top 200 players by points
    const res = await fetch(
      'https://stats.nba.com/stats/leagueLeaders?LeagueID=00&PerMode=PerGame&Scope=S&Season=2024-25&SeasonType=Regular+Season&StatCategory=PTS',
      { headers: NBA_HEADERS }
    )
    const data = await res.json()
    const statHeaders: string[] = data.resultSet.headers
    const statRows: any[][] = data.resultSet.rowSet

    const teams: any[] = []
    const players: any[] = []
    const seasons: any[] = []
    const teamsSeen = new Set<number>()

    for (const row of statRows.slice(0, 200)) {
      const r: Record<string, any> = {}
      statHeaders.forEach((h, i) => r[h] = row[i])

      const pid = `nba-player-${r.PLAYER_ID}`
      const tid = `nba-team-${r.TEAM_ID}`

      if (!teamsSeen.has(r.TEAM_ID)) {
        teamsSeen.add(r.TEAM_ID)
        teams.push({
          id: tid,
          league_id: 'nba-2024-25',
          name: r.TEAM,
          abbreviation: r.TEAM,
        })
      }

      players.push({
        id: pid,
        name: r.PLAYER,
        current_team_id: tid,
        external_id: String(r.PLAYER_ID),
      })

      seasons.push({
        id: `nba-season-${r.PLAYER_ID}-2024-25`,
        player_id: pid,
        team_id: tid,
        league_id: 'nba-2024-25',
        season: '2024-25',
        games_played: r.GP,
        pts: r.PTS,
        reb: r.REB,
        ast: r.AST,
        stl: r.STL,
        blk: r.BLK,
        tov: r.TOV,
        fg_pct: r.FG_PCT,
        three_pct: r.FG3_PCT,
        ft_pct: r.FT_PCT,
        minutes: r.MIN,
      })
    }

    const { error: teamsError } = await supabase.from('pro_teams').upsert(teams)
    if (teamsError) results.push(`Teams error: ${teamsError.message}`)
    else results.push(`${teams.length} teams upserted`)

    const { error: playersError } = await supabase.from('pro_players').upsert(players)
    if (playersError) results.push(`Players error: ${playersError.message}`)
    else results.push(`${players.length} players upserted`)

    const { error: seasonsError } = await supabase.from('pro_player_seasons').upsert(seasons)
    if (seasonsError) results.push(`Seasons error: ${seasonsError.message}`)
    else results.push(`${seasons.length} season stats upserted`)

    return NextResponse.json({ success: true, results })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
