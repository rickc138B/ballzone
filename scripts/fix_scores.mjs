import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const getEnv = (key) => env.match(new RegExp(`^${key}=["']?([^"'\n]+)["']?`, 'm'))?.[1]?.trim()
const supabase = createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'))

const GAME_IDS = [
  '0042500205', '0042500206', '0042500207', '0042500211', '0042500212',
  '0042500213', '0042500214', '0042500221', '0042500222', '0042500223',
  '0042500224', '0042500231', '0042500232', '0042500233', '0042500234',
  '0042500235', '0042500236', '0042500237', '0042500316', '0042500317',
  '0042500401', '0042500402'
]

for (const gameId of GAME_IDS) {
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`)
  if (!res.ok) { console.log(`HTTP ${res.status} for ${gameId}`); continue }
  const d = await res.json()
  const comps = d?.header?.competitions?.[0]
  if (!comps) { console.log(`No data for ${gameId}`); continue }
  const home = comps.competitors.find(t => t.homeAway === 'home')
  const away = comps.competitors.find(t => t.homeAway === 'away')
  const homeScore = parseInt(home?.score) || null
  const awayScore = parseInt(away?.score) || null
  const status = comps.status?.type?.completed ? 'final' : 'upcoming'
  
  const { error } = await supabase
    .from('pro_games')
    .update({ home_score: homeScore, away_score: awayScore, status })
    .eq('id', `nba-game-${gameId}`)
  
  console.log(`${gameId}: ${home?.team?.abbreviation} ${homeScore} vs ${away?.team?.abbreviation} ${awayScore} — ${error?.message ?? 'ok'}`)
}
