import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const getEnv = (key) => {
  const match = env.match(new RegExp(`^${key}=["']?([^"'\n]+)["']?`, 'm'))
  return match?.[1]?.trim()
}

const supabase = createClient(
  getEnv('NEXT_PUBLIC_SUPABASE_URL'),
  getEnv('SUPABASE_SERVICE_ROLE_KEY')
)

const NBA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://www.nba.com',
  'Accept': 'application/json',
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

function formatDateForNBA(isoDate) {
  const [y, m, d] = isoDate.split('-')
  return `${m}%2F${d}%2F${y}`
}

async function importGamesForDates(dates, teamByAbbr) {
  const allGames = []
  console.log(`\nFetching real scores for ${dates.length} game dates...`)

  for (const isoDate of dates) {
    try {
      const dateStr = formatDateForNBA(isoDate)
      const res = await fetch(
        `https://stats.nba.com/stats/scoreboardV2?DayOffset=0&LeagueID=00&gameDate=${dateStr}`,
        { headers: NBA_HEADERS }
      )
      if (!res.ok) { console.log(`  Scoreboard failed for ${isoDate}`); continue }

      const data = await res.json()
      const gameHeader = data.resultSets?.find(r => r.name === 'GameHeader')
      const lineScore = data.resultSets?.find(r => r.name === 'LineScore')

      if (!gameHeader?.rowSet?.length) continue

      const ghHeaders = gameHeader.headers
      const lsHeaders = lineScore?.headers ?? []

      // LineScore has 2 rows per game (home + away)
      const scoresByGameId = {}
      for (const row of lineScore?.rowSet ?? []) {
        const r = {}
        lsHeaders.forEach((h, i) => r[h] = row[i])
        if (!scoresByGameId[r.GAME_ID]) scoresByGameId[r.GAME_ID] = []
        scoresByGameId[r.GAME_ID].push(r)
      }

      for (const row of gameHeader.rowSet) {
        const r = {}
        ghHeaders.forEach((h, i) => r[h] = row[i])

        const gameId = r.GAME_ID
        const scores = scoresByGameId[gameId] ?? []

        // HOME team is always index 1 in LineScore, AWAY is index 0
        const away = scores[0]
        const home = scores[1]

        const homeAbbr = home?.TEAM_ABBREVIATION?.trim()
        const awayAbbr = away?.TEAM_ABBREVIATION?.trim()

        allGames.push({
          id: `nba-game-${gameId}`,
          league_id: 'nba-2024-25',
          season: '2024-25',
          game_date: isoDate,
          home_team_id: teamByAbbr[homeAbbr] ?? null,
          away_team_id: teamByAbbr[awayAbbr] ?? null,
          home_score: home?.PTS ?? null,
          away_score: away?.PTS ?? null,
          status: 'final',
        })
      }

      console.log(`  ${isoDate} — ${gameHeader.rowSet.length} games`)
      await sleep(300)
    } catch (e) {
      console.log(`  Error on ${isoDate}: ${e.message}`)
    }
  }

  return allGames
}

async function importPlayerGameLogs(players, teamByAbbr, seasonType) {
  let totalUpserted = 0
  let skipped = 0

  for (let i = 0; i < players.length; i++) {
    const player = players[i]
    if (!player.external_id) continue

    try {
      const url = `https://stats.nba.com/stats/playergamelog?PlayerID=${player.external_id}&Season=2024-25&SeasonType=${encodeURIComponent(seasonType)}`
      const res = await fetch(url, { headers: NBA_HEADERS })
      if (!res.ok) { skipped++; continue }

      const data = await res.json()
      const resultSet = data.resultSets?.[0]
      if (!resultSet?.rowSet?.length) { skipped++; continue }

      const headers = resultSet.headers
      const stats = []

      for (const row of resultSet.rowSet) {
        const r = {}
        headers.forEach((h, idx) => r[h] = row[idx])

        const matchupParts = (r.MATCHUP ?? '').split(/\s+(?:vs\.|@)\s+/)
        const opponentAbbr = matchupParts[1]?.trim()

        stats.push({
          id: `nba-gamelog-${player.external_id}-${r.Game_ID}`,
          player_id: player.id,
          team_id: player.current_team_id,
          opponent_id: teamByAbbr[opponentAbbr] ?? null,
          league_id: 'nba-2024-25',
          season: '2024-25',
          game_date: r.GAME_DATE ? new Date(r.GAME_DATE).toISOString().split('T')[0] : null,
          pts: r.PTS ?? 0,
          reb: r.REB ?? 0,
          ast: r.AST ?? 0,
          stl: r.STL ?? 0,
          blk: r.BLK ?? 0,
          tov: r.TOV ?? 0,
          fgm: r.FGM ?? 0,
          fga: r.FGA ?? 0,
          three_pm: r.FG3M ?? 0,
          three_pa: r.FG3A ?? 0,
          ftm: r.FTM ?? 0,
          fta: r.FTA ?? 0,
          minutes: r.MIN ?? '0',
        })
      }

      const { error } = await supabase
        .from('pro_game_stats')
        .upsert(stats, { onConflict: 'id' })

      if (error) {
        console.error(`  Player ${i+1} upsert error:`, error.message)
      } else {
        totalUpserted += stats.length
        console.log(`[${i+1}/${players.length}] ${seasonType} — ${player.external_id} — ${stats.length} games (total: ${totalUpserted})`)
      }

      await sleep(300)
    } catch (e) {
      console.error(`Player ${i+1} error:`, e.message)
      skipped++
    }
  }

  return { totalUpserted, skipped }
}

async function main() {
  console.log('Fetching players...')
  const { data: players, error } = await supabase
    .from('pro_players')
    .select('id, external_id, current_team_id')
    .not('external_id', 'is', null)

  if (error || !players?.length) {
    console.error('No players found:', error?.message)
    process.exit(1)
  }
  console.log(`Found ${players.length} players`)

  const { data: teams } = await supabase
    .from('pro_teams')
    .select('id, abbreviation')
    .eq('league_id', 'nba-2024-25')

  const teamByAbbr = {}
  for (const t of teams ?? []) {
    if (t.abbreviation) teamByAbbr[t.abbreviation] = t.id
  }

  // 1. Import regular season player logs (already done but upsert is safe)
  console.log('\n=== Regular Season Player Logs ===')
  const reg = await importPlayerGameLogs(players, teamByAbbr, 'Regular Season')
  console.log(`Regular season done: ${reg.totalUpserted} rows, ${reg.skipped} skipped`)

  // 2. Import playoff player logs
  console.log('\n=== Playoffs Player Logs ===')
  const playoffs = await importPlayerGameLogs(players, teamByAbbr, 'Playoffs')
  console.log(`Playoffs done: ${playoffs.totalUpserted} rows, ${playoffs.skipped} skipped`)

  // 3. Get all unique game dates from pro_game_stats
  const { data: dates } = await supabase
    .from('pro_game_stats')
    .select('game_date')
    .eq('league_id', 'nba-2024-25')

  const uniqueDates = [...new Set(dates?.map(d => d.game_date))].sort()
  console.log(`\nFound ${uniqueDates.length} unique game dates`)

  // 4. Fetch real scores for every date → seed pro_games
  const allGames = await importGamesForDates(uniqueDates, teamByAbbr)
  console.log(`\nUpserting ${allGames.length} games into pro_games...`)

  for (let i = 0; i < allGames.length; i += 100) {
    const batch = allGames.slice(i, i + 100)
    const { error: gErr } = await supabase
      .from('pro_games')
      .upsert(batch, { onConflict: 'id' })
    if (gErr) console.error(`Games batch error:`, gErr.message)
  }

  console.log(`\n✅ All done.`)
  console.log(`  Player game logs: ${reg.totalUpserted + playoffs.totalUpserted} rows`)
  console.log(`  Pro games: ${allGames.length} rows`)
}

main()
