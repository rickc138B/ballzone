import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const getEnv = (key) => {
  const match = env.match(new RegExp(`^${key}=["']?([^"'\n]+)["']?`, 'm'))
  return match?.[1]?.trim()
}

const NBA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://www.nba.com',
  'Accept': 'application/json',
}

// Test with a known date that has null team_ids
const res = await fetch(
  'https://stats.nba.com/stats/scoreboardV2?DayOffset=0&LeagueID=00&gameDate=10%2F22%2F2025',
  { headers: NBA_HEADERS }
)
const data = await res.json()
const lineScore = data.resultSets?.find(r => r.name === 'LineScore')
const headers = lineScore.headers
console.log('LineScore headers:', headers)
console.log('\nFirst 4 rows:')
for (const row of lineScore.rowSet.slice(0, 4)) {
  const r = {}
  headers.forEach((h, i) => r[h] = row[i])
  console.log(`  GAME_ID: ${r.GAME_ID}, TEAM_ABBREVIATION: "${r.TEAM_ABBREVIATION}", PTS: ${r.PTS}`)
}
