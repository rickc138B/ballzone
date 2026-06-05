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

async function main() {
  console.log('=== NBA 2025-26 Full Import ===\n')

  // 1. Fetch top 200 players by points for 2025-26
  console.log('Fetching 2025-26 league leaders...')
  const res = await fetch(
    'https://stats.nba.com/stats/leagueLeaders?LeagueID=00&PerMode=PerGame&Scope=S&Season=2025-26&SeasonType=Regular+Season&StatCategory=PTS',
    { headers: NBA_HEADERS }
  )
  const data = await res.json()
  const statHeaders = data.resultSet.headers
  const statRows = data.resultSet.rowSet
  console.log(`Got ${statRows.length} players`)

  const teams = []
  const players = []
  const seasons = []
  const teamsSeen = new Set()

  for (const row of statRows.slice(0, 200)) {
    const r = {}
    statHeaders.forEach((h, i) => r[h] = row[i])

    const pid = `nba-player-${r.PLAYER_ID}`
    const tid = `nba-team-${r.TEAM_ID}`

    if (!teamsSeen.has(r.TEAM_ID)) {
      teamsSeen.add(r.TEAM_ID)
      teams.push({
        id: tid,
        league_id: 'nba-2025-26',
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
      id: `nba-season-${r.PLAYER_ID}-2025-26`,
      player_id: pid,
      team_id: tid,
      league_id: 'nba-2025-26',
      season: '2025-26',
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

  // Upsert teams
  const { error: teamsErr } = await supabase.from('pro_teams').upsert(teams)
  if (teamsErr) console.error('Teams error:', teamsErr.message)
  else console.log(`✓ ${teams.length} teams upserted`)

  // Upsert players
  const { error: playersErr } = await supabase.from('pro_players').upsert(players)
  if (playersErr) console.error('Players error:', playersErr.message)
  else console.log(`✓ ${players.length} players upserted`)

  // Upsert season stats
  const { error: seasonsErr } = await supabase.from('pro_player_seasons').upsert(seasons)
  if (seasonsErr) console.error('Seasons error:', seasonsErr.message)
  else console.log(`✓ ${seasons.length} season stats upserted`)

  // Build team lookup for game logs
  const { data: allTeams } = await supabase
    .from('pro_teams')
    .select('id, abbreviation')
    .eq('league_id', 'nba-2025-26')

  const teamByAbbr = {}
  for (const t of allTeams ?? []) {
    if (t.abbreviation) teamByAbbr[t.abbreviation] = t.id
  }

  // 2. Import player game logs — regular season + playoffs
  for (const seasonType of ['Regular Season', 'Playoffs']) {
    console.log(`\n=== ${seasonType} Game Logs ===`)
    let total = 0
    let skipped = 0

    for (let i = 0; i < players.length; i++) {
      const player = players[i]
      try {
        const url = `https://stats.nba.com/stats/playergamelog?PlayerID=${player.external_id}&Season=2025-26&SeasonType=${encodeURIComponent(seasonType)}`
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
            league_id: 'nba-2025-26',
            season: '2025-26',
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

        if (error) console.error(`  Player ${i+1} error:`, error.message)
        else {
          total += stats.length
          console.log(`[${i+1}/${players.length}] ${seasonType} — ${player.external_id} — ${stats.length} games (total: ${total})`)
        }

        await sleep(300)
      } catch (e) {
        skipped++
      }
    }
    console.log(`${seasonType} done: ${total} rows, ${skipped} skipped`)
  }

  // 3. Seed pro_games with real scores
  console.log('\n=== Seeding pro_games with real scores ===')

  const { data: dateRows } = await supabase
    .from('pro_game_stats')
    .select('game_date')
    .eq('league_id', 'nba-2025-26')

  const uniqueDates = [...new Set(dateRows?.map(d => d.game_date))].sort()
  console.log(`Found ${uniqueDates.length} unique game dates`)

  const allGames = []

  for (let i = 0; i < uniqueDates.length; i++) {
    const isoDate = uniqueDates[i]
    try {
      const dateStr = formatDateForNBA(isoDate)
      const res = await fetch(
        `https://stats.nba.com/stats/scoreboardV2?DayOffset=0&LeagueID=00&gameDate=${dateStr}`,
        { headers: NBA_HEADERS }
      )
      if (!res.ok) continue

      const data = await res.json()
      const gameHeader = data.resultSets?.find(r => r.name === 'GameHeader')
      const lineScore = data.resultSets?.find(r => r.name === 'LineScore')
      if (!gameHeader?.rowSet?.length) continue

      const ghHeaders = gameHeader.headers
      const lsHeaders = lineScore?.headers ?? []

      const scoresByGameId = {}
      for (const row of lineScore?.rowSet ?? []) {
        const r = {}
        lsHeaders.forEach((h, idx) => r[h] = row[idx])
        if (!scoresByGameId[r.GAME_ID]) scoresByGameId[r.GAME_ID] = []
        scoresByGameId[r.GAME_ID].push(r)
      }

      for (const row of gameHeader.rowSet) {
        const r = {}
        ghHeaders.forEach((h, idx) => r[h] = row[idx])
        const gameId = r.GAME_ID
        const scores = scoresByGameId[gameId] ?? []
        const away = scores[0]
        const home = scores[1]

        allGames.push({
          id: `nba-game-${gameId}`,
          league_id: 'nba-2025-26',
          season: '2025-26',
          game_date: isoDate,
          home_team_id: teamByAbbr[home?.TEAM_ABBREVIATION?.trim()] ?? null,
          away_team_id: teamByAbbr[away?.TEAM_ABBREVIATION?.trim()] ?? null,
          home_score: home?.PTS ?? null,
          away_score: away?.PTS ?? null,
          status: 'final',
        })
      }

      console.log(`  [${i+1}/${uniqueDates.length}] ${isoDate} — ${gameHeader.rowSet.length} games`)
      await sleep(400)
    } catch (e) {
      console.log(`  ${isoDate} error: ${e.message}`)
    }
  }

  console.log(`\nUpserting ${allGames.length} games into pro_games...`)
  for (let i = 0; i < allGames.length; i += 100) {
    const batch = allGames.slice(i, i + 100)
    const { error } = await supabase.from('pro_games').upsert(batch, { onConflict: 'id' })
    if (error) console.error(`Batch error:`, error.message)
    else console.log(`  Batch ${i/100+1} done (${batch.length} rows)`)
  }

  console.log('\n✅ 2025-26 import complete')
}

main()
