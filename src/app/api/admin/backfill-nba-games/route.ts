import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

const NBA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.nba.com/',
  'Origin': 'https://www.nba.com',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
  'Connection': 'keep-alive',
}

function fmtDateForNBA(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${mm}%2F${dd}%2F${yyyy}`
}

function isoDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function dateRange(startIso: string, endIso: string): Date[] {
  const dates: Date[] = []
  const cur = new Date(startIso + 'T12:00:00Z')
  const end = new Date(endIso + 'T12:00:00Z')
  while (cur <= end) {
    dates.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

export async function POST(req: NextRequest) {
  try {
    const { secret, from, to } = await req.json()
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Default: Apr 10 2026 → today
    const startDate = from ?? '2026-04-10'
    const endDate = to ?? isoDate(new Date())

    const supabase = createServiceClient()
    const results: string[] = []

    // Build maps
    const { data: players } = await supabase
      .from('pro_players')
      .select('id, external_id, current_team_id')
      .not('external_id', 'is', null)

    const playerMap: Record<string, { id: string; team_id: string }> = {}
    for (const p of players ?? []) {
      if (p.external_id) playerMap[p.external_id] = { id: p.id, team_id: p.current_team_id }
    }

    const { data: teams } = await supabase
      .from('pro_teams')
      .select('id, abbreviation')
      .eq('league_id', 'nba-2025-26')

    const teamByAbbr: Record<string, string> = {}
    for (const t of teams ?? []) {
      if (t.abbreviation) teamByAbbr[t.abbreviation] = t.id
    }
    // Team IDs are derived as nba-team-{NBA_TEAM_ID}
    const teamIdFromExternal = (extId: string) => `nba-team-${extId}`

    const dates = dateRange(startDate, endDate)
    results.push(`Backfilling ${dates.length} dates: ${startDate} → ${endDate}`)

    let totalGames = 0
    let totalStats = 0

    for (const date of dates) {
      const nbaFmt = fmtDateForNBA(date)
      const iso = isoDate(date)

      try {
        const sbRes = await fetch(
          `https://stats.nba.com/stats/scoreboardV2?DayOffset=0&LeagueID=00&gameDate=${nbaFmt}`,
          { headers: NBA_HEADERS }
        )
        if (!sbRes.ok) { results.push(`${iso}: scoreboard ${sbRes.status}`); continue }

        const sbData = await sbRes.json()
        const gameHeader = sbData.resultSets?.find((r: any) => r.name === 'GameHeader')
        const lineScore = sbData.resultSets?.find((r: any) => r.name === 'LineScore')

        if (!gameHeader?.rowSet?.length) { results.push(`${iso}: no games`); continue }

        // Build scores map from LineScore
        // LineScore headers: GAME_DATE_EST, GAME_SEQUENCE, GAME_ID, TEAM_ID, TEAM_ABBREVIATION, ...PTS
        const lsHeaders: string[] = lineScore?.headers ?? []
        const ptsIdx = lsHeaders.indexOf('PTS')
        const gameIdIdx = lsHeaders.indexOf('GAME_ID')
        const teamIdIdx = lsHeaders.indexOf('TEAM_ID')

        const scoresByGame: Record<string, { teamId: string; pts: number }[]> = {}
        for (const row of lineScore?.rowSet ?? []) {
          const gid = row[gameIdIdx]
          if (!scoresByGame[gid]) scoresByGame[gid] = []
          scoresByGame[gid].push({ teamId: String(row[teamIdIdx]), pts: row[ptsIdx] ?? 0 })
        }

        // GameHeader: index 2 = GAME_ID, 6 = HOME_TEAM_ID, 7 = VISITOR_TEAM_ID
        const ghHeaders: string[] = gameHeader.headers ?? []
        const ghGameIdIdx = ghHeaders.indexOf('GAME_ID')
        const ghHomeIdx = ghHeaders.indexOf('HOME_TEAM_ID')
        const ghAwayIdx = ghHeaders.indexOf('VISITOR_TEAM_ID')
        const ghStatusIdx = ghHeaders.indexOf('GAME_STATUS_TEXT')

        const proGames: any[] = []
        const gameIds: string[] = []

        for (const row of gameHeader.rowSet) {
          const gameId = row[ghGameIdIdx]
          const homeExtId = String(row[ghHomeIdx])
          const awayExtId = String(row[ghAwayIdx])
          const status = row[ghStatusIdx] ?? 'Final'

          const homeTeamId = teamIdFromExternal(homeExtId)
          const awayTeamId = teamIdFromExternal(awayExtId)
          if (!homeTeamId || !awayTeamId) continue

          const scores = scoresByGame[gameId] ?? []
          const homeScore = scores.find(s => s.teamId === homeExtId)?.pts ?? 0
          const awayScore = scores.find(s => s.teamId === awayExtId)?.pts ?? 0

          // Only store finished games
          if (homeScore === 0 && awayScore === 0) continue

          proGames.push({
            id: `nba-game-${gameId}`,
            league_id: 'nba-2025-26',
            game_date: iso,
                game_id: `nba-game-${gameId}`,
            home_team_id: homeTeamId,
            away_team_id: awayTeamId,
            home_score: homeScore,
            away_score: awayScore,
            status: status,
          })
          gameIds.push(gameId)
        }

        if (proGames.length) {
          const { error } = await supabase.from('pro_games').upsert(proGames, { onConflict: 'id' })
          if (error) results.push(`${iso}: pro_games upsert error: ${error.message}`)
          else { totalGames += proGames.length; results.push(`${iso}: ${proGames.length} games`) }
        }

        // Box scores
        const allStats: any[] = []
        for (const gameId of gameIds) {
          try {
            const boxRes = await fetch(
              `https://stats.nba.com/stats/boxscoretraditionalv2?GameID=${gameId}&StartPeriod=0&EndPeriod=10&StartRange=0&EndRange=28800&RangeType=0`,
              { headers: NBA_HEADERS }
            )
            if (!boxRes.ok) continue

            const boxData = await boxRes.json()
            const playerStats = boxData.resultSets?.find((r: any) => r.name === 'PlayerStats')
            if (!playerStats) continue

            const h: string[] = playerStats.headers
            for (const row of playerStats.rowSet) {
              const r: Record<string, any> = {}
              h.forEach((key, idx) => r[key] = row[idx])

              const externalId = String(r.PLAYER_ID)
              const mapped = playerMap[externalId]
              if (!mapped) continue

              const matchupParts = (r.MATCHUP as string ?? '').split(/\s+(?:vs\.|@)\s+/)
              const opponentAbbr = matchupParts[1]?.trim()

              allStats.push({
                id: `nba-gamelog-${externalId}-${gameId}`,
                player_id: mapped.id,
                team_id: mapped.team_id,
                opponent_id: teamByAbbr[opponentAbbr] ?? null,
                league_id: 'nba-2025-26',
                season: '2025-26',
                game_date: iso,
                game_id: `nba-game-${gameId}`,
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
          } catch { /* skip bad game */ }
        }

        if (allStats.length) {
          for (let i = 0; i < allStats.length; i += 500) {
            const { error } = await supabase.from('pro_game_stats').upsert(allStats.slice(i, i + 500), { onConflict: 'id' })
            if (!error) totalStats += Math.min(500, allStats.length - i)
          }
        }

        await new Promise(r => setTimeout(r, 500))
      } catch (e: any) {
        results.push(`${iso}: error — ${e.message}`)
      }
    }

    results.push(`Done. ${totalGames} games, ${totalStats} player stats upserted.`)
    return NextResponse.json({ success: true, results })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
