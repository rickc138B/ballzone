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

function formatDate(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${mm}%2F${dd}%2F${yyyy}`
}

const teamIdFromExternal = (extId: string) => `nba-team-${extId}`

const ESPN_ABBR_MAP: Record<string, string> = {
  'NY': 'NYK', 'GS': 'GSW', 'SA': 'SAS',
  'NO': 'NOP', 'UTH': 'UTA', 'UTAH': 'UTA',
}
const normalizeAbbr = (a: string) => ESPN_ABBR_MAP[a] ?? a

async function espnFallback(isoDate: string, supabase: any, teamByAbbr: Record<string, string>) {
  const fmt = isoDate.replace(/-/g, '')
  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${fmt}`,
    { signal: AbortSignal.timeout(8000) }
  )
  if (!res.ok) return []
  const data = await res.json()
  const games = []
  const { data: existingGames } = await supabase
    .from('pro_games')
    .select('id, home_team_id, away_team_id')
    .eq('game_date', isoDate)
    .eq('league_id', 'nba-2025-26')

  for (const event of data.events ?? []) {
    const comp = event.competitions?.[0]
    if (!comp) continue
    const home = comp.competitors?.find((c: any) => c.homeAway === 'home')
    const away = comp.competitors?.find((c: any) => c.homeAway === 'away')
    if (!home || !away) continue
    const homeTeamId = teamByAbbr[normalizeAbbr(home.team.abbreviation)]
    const awayTeamId = teamByAbbr[normalizeAbbr(away.team.abbreviation)]
    if (!homeTeamId || !awayTeamId) continue
    const homeScore = parseInt(home.score ?? '0')
    const awayScore = parseInt(away.score ?? '0')
    if (homeScore === 0 && awayScore === 0) continue
    const existing = (existingGames ?? []).find((g: any) =>
      g.home_team_id === homeTeamId && g.away_team_id === awayTeamId
    )
    if (existing) {
      await supabase.from('pro_games')
        .update({ home_score: homeScore, away_score: awayScore, status: comp.status?.type?.description ?? 'Final' })
        .eq('id', existing.id)
      games.push(existing.id.replace('nba-game-', ''))
    }
  }
  return games
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const results: string[] = []

  try {
    // Check both yesterday and today (late games finishing near midnight ET)
    const targetDate = new Date()
    const hourUTC = targetDate.getUTCHours()
    // Before 8am UTC (4am ET), yesterday's late games may not be posted yet — check yesterday
    if (hourUTC < 8) targetDate.setDate(targetDate.getDate() - 1)
    const dateStr = formatDate(targetDate)
    const isoDate = targetDate.toISOString().split('T')[0]

    // Also always try yesterday in case of late-finishing games
    const yesterdayDate = new Date(targetDate)
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterdayIso = yesterdayDate.toISOString().split('T')[0]
    const yesterday = targetDate

    // Build team map early (needed for ESPN fallback)
    const { data: teams } = await supabase
      .from('pro_teams')
      .select('id, abbreviation')
      .eq('league_id', 'nba-2025-26')

    const teamByAbbr: Record<string, string> = {}
    for (const t of teams ?? []) {
      if (t.abbreviation) teamByAbbr[t.abbreviation] = t.id
    }

    const scoreboardRes = await fetch(
      `https://stats.nba.com/stats/scoreboardV2?DayOffset=0&LeagueID=00&gameDate=${dateStr}`,
      { headers: NBA_HEADERS }
    )
    if (!scoreboardRes.ok) {
      return NextResponse.json({ error: `Scoreboard fetch failed: ${scoreboardRes.status}` }, { status: 500 })
    }

    const scoreboardData = await scoreboardRes.json()
    const gameHeader = scoreboardData.resultSets?.find((r: any) => r.name === 'GameHeader')
    const lineScore = scoreboardData.resultSets?.find((r: any) => r.name === 'LineScore')

    if (!gameHeader?.rowSet?.length) {
      results.push('No games from NBA API, trying ESPN fallback')
      const espnIds = await espnFallback(isoDate, supabase, teamByAbbr)
      const espnYestIds = await espnFallback(yesterdayIso, supabase, teamByAbbr)
      results.push(`ESPN fallback: ${espnIds.length + espnYestIds.length} games patched`)
      return NextResponse.json({ success: true, results })
    }

    // Build scores map from LineScore
    const lsH: string[] = lineScore?.headers ?? []
    const lsPtsIdx = lsH.indexOf('PTS')
    const lsGameIdIdx = lsH.indexOf('GAME_ID')
    const lsTeamIdIdx = lsH.indexOf('TEAM_ID')

    const scoresByGame: Record<string, { teamId: string; pts: number }[]> = {}
    for (const row of lineScore?.rowSet ?? []) {
      const gid = row[lsGameIdIdx]
      if (!scoresByGame[gid]) scoresByGame[gid] = []
      scoresByGame[gid].push({ teamId: String(row[lsTeamIdIdx]), pts: row[lsPtsIdx] ?? 0 })
    }

    // Parse GameHeader for home/away team IDs
    const ghH: string[] = gameHeader.headers ?? []
    const ghGameIdIdx = ghH.indexOf('GAME_ID')
    const ghHomeIdx = ghH.indexOf('HOME_TEAM_ID')
    const ghAwayIdx = ghH.indexOf('VISITOR_TEAM_ID')
    const ghStatusIdx = ghH.indexOf('GAME_STATUS_TEXT')

    const proGames: any[] = []
    const gameIds: string[] = []

    for (const row of gameHeader.rowSet) {
      const gameId = row[ghGameIdIdx]
      const homeExtId = String(row[ghHomeIdx])
      const awayExtId = String(row[ghAwayIdx])
      const status = row[ghStatusIdx] ?? 'Final'

      const scores = scoresByGame[gameId] ?? []
      const homeScore = scores.find(s => s.teamId === homeExtId)?.pts ?? 0
      const awayScore = scores.find(s => s.teamId === awayExtId)?.pts ?? 0
      if (homeScore === 0 && awayScore === 0) continue

      proGames.push({
        id: `nba-game-${gameId}`,
        league_id: 'nba-2025-26',
        game_date: isoDate,
                game_id: `nba-game-${gameId}`,
        home_team_id: teamIdFromExternal(homeExtId),
        away_team_id: teamIdFromExternal(awayExtId),
        home_score: homeScore,
        away_score: awayScore,
        status,
      })
      gameIds.push(gameId)
    }

    if (proGames.length) {
      const { error } = await supabase.from('pro_games').upsert(proGames, { onConflict: 'id' })
      if (error) results.push(`pro_games upsert error: ${error.message}`)
      else results.push(`Upserted ${proGames.length} games`)
    }

    results.push(`Found ${gameIds.length} games on ${isoDate}`)

    // Player map
    const { data: players } = await supabase
      .from('pro_players')
      .select('id, external_id, current_team_id')
      .not('external_id', 'is', null)

    const playerMap: Record<string, { id: string; team_id: string }> = {}
    for (const p of players ?? []) {
      if (p.external_id) playerMap[p.external_id] = { id: p.id, team_id: p.current_team_id }
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
            game_date: isoDate,
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

    // Fan-out notifications to team followers
    if (proGames.length) {
      try {
        const teamIds = [...new Set(proGames.flatMap(g => [g.home_team_id, g.away_team_id]))]
        const { data: followRows } = await supabase
          .from('follows')
          .select('follower_id, target_id')
          .in('target_id', teamIds)
          .eq('target_type', 'team')

        if (followRows?.length) {
          // Get team names for notification text
          const { data: teamRows } = await supabase
            .from('pro_teams')
            .select('id, name, abbreviation')
            .in('id', teamIds)
          const teamName: Record<string, string> = {}
          for (const t of teamRows ?? []) teamName[t.id] = t.abbreviation ?? t.name

          const notifs: any[] = []
          for (const game of proGames) {
            const homeAbbr = teamName[game.home_team_id] ?? game.home_team_id
            const awayAbbr = teamName[game.away_team_id] ?? game.away_team_id
            const isFinal = game.status?.toLowerCase().includes('final')
            const title = isFinal
              ? `${awayAbbr} ${game.away_score} – ${game.home_score} ${homeAbbr} · Final`
              : `${awayAbbr} vs ${homeAbbr} · ${game.status}`
            const affected = followRows.filter(f =>
              f.target_id === game.home_team_id || f.target_id === game.away_team_id
            )
            for (const f of affected) {
              notifs.push({
                profile_id: f.follower_id,
                type: isFinal ? 'game_final' : 'game_update',
                title,
                body: `${game.game_date}`,
                data: { gameId: game.id, homeTeamId: game.home_team_id, awayTeamId: game.away_team_id },
                read: false,
              })
            }
          }

          if (notifs.length) {
            const { error: notifErr } = await supabase.from('notifications').upsert(notifs, { ignoreDuplicates: false })
            if (notifErr) results.push(`Notif fan-out error: ${notifErr.message}`)
            else results.push(`Sent ${notifs.length} notifications to team followers`)
          }
        }
      } catch (e: any) {
        results.push(`Notif fan-out failed: ${e.message}`)
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
