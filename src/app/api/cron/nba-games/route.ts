import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

const NBA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://www.nba.com',
  'Accept': 'application/json',
}

function formatDate(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${mm}%2F${dd}%2F${yyyy}`
}

export async function GET(req: NextRequest) {
  // Vercel cron sends Authorization header
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const results: string[] = []

  try {
    // Fetch yesterday's scoreboard
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateStr = formatDate(yesterday)
    const isoDate = yesterday.toISOString().split('T')[0]

    const scoreboardRes = await fetch(
      `https://stats.nba.com/stats/scoreboardV2?DayOffset=0&LeagueID=00&gameDate=${dateStr}`,
      { headers: NBA_HEADERS }
    )

    if (!scoreboardRes.ok) {
      return NextResponse.json({ error: `Scoreboard fetch failed: ${scoreboardRes.status}` }, { status: 500 })
    }

    const scoreboardData = await scoreboardRes.json()
    const gameHeader = scoreboardData.resultSets?.find((r: any) => r.name === 'GameHeader')
    if (!gameHeader?.rowSet?.length) {
      return NextResponse.json({ success: true, results: ['No games yesterday'] })
    }

    const gameIds: string[] = gameHeader.rowSet.map((row: any[]) => row[2]) // GAME_ID is index 2
    results.push(`Found ${gameIds.length} games on ${isoDate}`)

    // Get our player map (external_id → our id + team_id)
    const { data: players } = await supabase
      .from('pro_players')
      .select('id, external_id, current_team_id')
      .not('external_id', 'is', null)

    const playerMap: Record<string, { id: string; team_id: string }> = {}
    for (const p of players ?? []) {
      if (p.external_id) playerMap[p.external_id] = { id: p.id, team_id: p.current_team_id }
    }

    // Get team map
    const { data: teams } = await supabase
      .from('pro_teams')
      .select('id, abbreviation')
      .eq('league_id', 'nba-2024-25')

    const teamByAbbr: Record<string, string> = {}
    for (const t of teams ?? []) {
      if (t.abbreviation) teamByAbbr[t.abbreviation] = t.id
    }

    const allStats: any[] = []

    for (const gameId of gameIds) {
      try {
        const boxRes = await fetch(
          `https://stats.nba.com/stats/boxscoretraditionalv2?GameID=${gameId}&StartPeriod=0&EndPeriod=10&StartRange=0&EndRange=28800&RangeType=0`,
          { headers: NBA_HEADERS }
        )
        if (!boxRes.ok) { results.push(`Box score failed for ${gameId}`); continue }

        const boxData = await boxRes.json()
        const playerStats = boxData.resultSets?.find((r: any) => r.name === 'PlayerStats')
        if (!playerStats) continue

        const h: string[] = playerStats.headers
        for (const row of playerStats.rowSet) {
          const r: Record<string, any> = {}
          h.forEach((key, idx) => r[key] = row[idx])

          const externalId = String(r.PLAYER_ID)
          const mapped = playerMap[externalId]
          if (!mapped) continue // player not in our DB, skip

          const matchupParts = (r.MATCHUP as string ?? '').split(/\s+(?:vs\.|@)\s+/)
          const opponentAbbr = matchupParts[1]?.trim()

          allStats.push({
            id: `nba-gamelog-${externalId}-${gameId}`,
            player_id: mapped.id,
            team_id: mapped.team_id,
            opponent_id: teamByAbbr[opponentAbbr] ?? null,
            league_id: 'nba-2024-25',
            season: '2024-25',
            game_date: isoDate,
            pts: r.PTS ?? 0,
            reb: r.REB ?? 0,
            ast: r.AST ?? 0,
            stl: r.STL ?? 0,
            blk: r.BLK ?? 0,
            tov: r.TO ?? 0,
            fgm: r.FGM ?? 0,
            fga: r.FGA ?? 0,
            three_pm: r.FG3M ?? 0,
            three_pa: r.FG3A ?? 0,
            ftm: r.FTM ?? 0,
            fta: r.FTA ?? 0,
            minutes: r.MIN ?? '0',
          })
        }

        await new Promise(r => setTimeout(r, 300))
      } catch (e: any) {
        results.push(`Error on game ${gameId}: ${e.message}`)
      }
    }

    if (allStats.length) {
      const { error } = await supabase.from('pro_game_stats').upsert(allStats, { onConflict: 'id' })
      if (error) results.push(`Upsert error: ${error.message}`)
      else results.push(`Upserted ${allStats.length} player game stats`)
    } else {
      results.push('No stats to upsert')
    }

    return NextResponse.json({ success: true, results })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
