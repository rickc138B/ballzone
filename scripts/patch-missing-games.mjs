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
  'Referer': 'https://www.nba.com/',
  'Origin': 'https://www.nba.com',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
  'Connection': 'keep-alive',
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// Dates to patch — add any missing dates here
const PATCH_DATES = ['2026-05-13', '2026-05-15', '2026-05-17', '2026-05-28', '2026-05-30', '2026-06-03', '2026-06-05']

function formatDateForNBA(isoDate) {
  const [y, m, d] = isoDate.split('-')
  return `${m}/${d}/${y}`
}

async function main() {
  const { data: teams } = await supabase
    .from('pro_teams')
    .select('id, abbreviation')
    .eq('league_id', 'nba-2025-26')

  const teamByAbbr = {}
  for (const t of teams ?? []) {
    if (t.abbreviation) teamByAbbr[t.abbreviation] = t.id
  }

  const { data: players } = await supabase
    .from('pro_players')
    .select('id, external_id, current_team_id')
    .not('external_id', 'is', null)

  const playerByExternal = {}
  for (const p of players ?? []) {
    if (p.external_id) playerByExternal[p.external_id] = p
  }

  for (const isoDate of PATCH_DATES) {
    console.log(`\nPatching ${isoDate}...`)
    const dateStr = formatDateForNBA(isoDate)

    // 1. Get scoreboard for real scores
    const sbRes = await fetch(
      `https://stats.nba.com/stats/scoreboardV3?GameDate=${dateStr}&LeagueID=00`,
      { headers: NBA_HEADERS }
    )
    console.log(`  Scoreboard status: ${sbRes.status}`)
    if (!sbRes.ok) { continue }

    const sbData = await sbRes.json()
    const sbGames = sbData.scoreboard?.games ?? []

    if (!sbGames.length) { console.log(`  No games`); continue }

    const games = []
    const gameIds = []

    for (const g of sbGames) {
      const gameId = g.gameId
      const homeAbbr = g.homeTeam?.teamTricode?.trim()
      const awayAbbr = g.awayTeam?.teamTricode?.trim()
      const homeScore = g.gameStatus === 3 ? (g.homeTeam?.score ?? null) : null
      const awayScore = g.gameStatus === 3 ? (g.awayTeam?.score ?? null) : null

      gameIds.push(gameId)
      games.push({
        id: `nba-game-${gameId}`,
        league_id: 'nba-2025-26',
        season: '2025-26',
        game_date: isoDate,
        home_team_id: teamByAbbr[homeAbbr] ?? null,
        away_team_id: teamByAbbr[awayAbbr] ?? null,
        home_score: homeScore,
        away_score: awayScore,
        status: g.gameStatus === 3 ? 'final' : 'scheduled',
      })
    }

    const { error: gErr } = await supabase.from('pro_games').upsert(games, { onConflict: 'id' })
    if (gErr) console.error(`  pro_games error:`, gErr.message)
    else console.log(`  ✓ ${games.length} games upserted`)

    // 2. Get box scores for each game
    for (const gameId of gameIds) {
      await sleep(400)
      const boxRes = await fetch(
        `https://stats.nba.com/stats/boxscoretraditionalv2?GameID=${gameId}&StartPeriod=0&EndPeriod=10&StartRange=0&EndRange=28800&RangeType=0`,
        { headers: NBA_HEADERS }
      )
      if (!boxRes.ok) { console.log(`  Box score HTTP ${boxRes.status} for ${gameId}`); continue }

      const boxData = await boxRes.json()
      const playerStats = boxData.resultSets?.find(r => r.name === 'PlayerStats')
      if (!playerStats) continue

      const h = playerStats.headers
      const stats = []

      for (const row of playerStats.rowSet) {
        const r = {}
        h.forEach((key, idx) => r[key] = row[idx])

        const externalId = String(r.PLAYER_ID)
        const mapped = playerByExternal[externalId]
        if (!mapped) continue

        const matchupParts = (r.MATCHUP ?? '').split(/\s+(?:vs\.|@)\s+/)
        const opponentAbbr = matchupParts[1]?.trim()

        stats.push({
          id: `nba-gamelog-${externalId}-${gameId}`,
          game_id: `nba-game-${gameId}`,
          player_id: mapped.id,
          team_id: mapped.current_team_id,
          opponent_id: teamByAbbr[opponentAbbr] ?? null,
          league_id: 'nba-2025-26',
          season: '2025-26',
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

      const { error: sErr } = await supabase
        .from('pro_game_stats')
        .upsert(stats, { onConflict: 'id' })

      if (sErr) console.error(`  Stats error for ${gameId}:`, sErr.message)
      else console.log(`  ✓ Game ${gameId} — ${stats.length} player stats`)
    }
  }

  console.log('\n✅ Patch complete')
}

main()
