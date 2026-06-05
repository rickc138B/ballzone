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

async function main() {
  const { data: games } = await supabase
    .from('pro_games')
    .select('id, game_date, home_team_id, away_team_id')
    .eq('league_id', 'nba-2025-26')
    .not('home_team_id', 'is', null)
    .not('home_score', 'is', null)

  console.log(`Found ${games?.length} total games`)

  const { data: allStats } = await supabase
    .from('pro_game_stats')
    .select('game_date, team_id')
    .eq('league_id', 'nba-2025-26')

  const countMap = {}
  for (const s of allStats ?? []) {
    const key = `${s.game_date}|${s.team_id}`
    countMap[key] = (countMap[key] ?? 0) + 1
  }

  const incompleteGames = (games ?? []).filter(g => {
    const homeCount = countMap[`${g.game_date}|${g.home_team_id}`] ?? 0
    const awayCount = countMap[`${g.game_date}|${g.away_team_id}`] ?? 0
    return homeCount < 5 || awayCount < 5
  })

  console.log(`Found ${incompleteGames.length} games with incomplete stats`)

  const { data: teams } = await supabase
    .from('pro_teams')
    .select('id, abbreviation')
    .eq('league_id', 'nba-2025-26')

  const teamByAbbr = {}
  for (const t of teams ?? []) teamByAbbr[t.abbreviation] = t.id

  const { data: existingPlayers } = await supabase
    .from('pro_players')
    .select('id, external_id')

  const playerByExternal = {}
  for (const p of existingPlayers ?? []) {
    if (p.external_id) playerByExternal[p.external_id] = p.id
  }

  let totalUpserted = 0

  for (let i = 166; i < incompleteGames.length; i++) {
    const game = incompleteGames[i]
    const nbaGameId = game.id.replace('nba-game-', '')

    try {
      const res = await fetch(
        `https://stats.nba.com/stats/boxscoretraditionalv2?GameID=${nbaGameId}&StartPeriod=0&EndPeriod=10&StartRange=0&EndRange=28800&RangeType=0`,
        { headers: NBA_HEADERS }
      )
      if (!res.ok) { console.log(`  [${i+1}] HTTP ${res.status} for ${nbaGameId}`); continue }

      const data = await res.json()
      const playerStats = data.resultSets?.find(r => r.name === 'PlayerStats')
      if (!playerStats?.rowSet?.length) { console.log(`  [${i+1}] No stats for ${nbaGameId}`); continue }

      const h = playerStats.headers
      const newPlayers = []
      const stats = []

      for (const row of playerStats.rowSet) {
        const r = {}
        h.forEach((key, idx) => r[key] = row[idx])

        const externalId = String(r.PLAYER_ID)
        const teamAbbr = r.TEAM_ABBREVIATION?.trim()
        const teamId = teamByAbbr[teamAbbr] ?? null

        if (!playerByExternal[externalId]) {
          const newPlayerId = `nba-player-${externalId}`
          newPlayers.push({
            id: newPlayerId,
            name: r.PLAYER_NAME,
            current_team_id: teamId,
            external_id: externalId,
          })
          playerByExternal[externalId] = newPlayerId
        }

        const matchupParts = (r.MATCHUP ?? '').split(/\s+(?:vs\.|@)\s+/)
        const opponentAbbr = matchupParts[1]?.trim()

        // Skip DNPs (null minutes)
        if (!r.MIN || r.MIN === null) continue

        stats.push({
          id: `nba-gamelog-${externalId}-${nbaGameId}`,
          player_id: playerByExternal[externalId],
          team_id: teamId,
          opponent_id: teamByAbbr[opponentAbbr] ?? null,
          league_id: 'nba-2025-26',
          season: '2025-26',
          game_date: game.game_date,
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

      if (newPlayers.length) {
        const { error: pErr } = await supabase
          .from('pro_players')
          .upsert(newPlayers, { onConflict: 'id' })
        if (pErr) console.error(`  Player upsert error:`, pErr.message)
      }

      const { error } = await supabase
        .from('pro_game_stats')
        .upsert(stats, { onConflict: 'id' })

      if (error) console.error(`  [${i+1}] Stats error:`, error.message)
      else {
        totalUpserted += stats.length
        console.log(`  [${i+1}/${incompleteGames.length}] ${nbaGameId} — ${stats.length} stats (${newPlayers.length} new players)`)
      }

      if (i % 50 === 49) { console.log("  Pausing 5s..."); await sleep(5000) } else { await sleep(400) }
    } catch (e) {
      console.error(`  [${i+1}] Error:`, e.message)
    }
  }

  console.log(`\n✅ Done. Upserted ${totalUpserted} stats across ${incompleteGames.length} games.`)
}

main()
