import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
 process.env.NEXT_PUBLIC_SUPABASE_URL!,
 process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

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

function espnDateFmt(d: Date) {
 return d.toISOString().split('T')[0].replace(/-/g, '')
}

function nbaDateFmt(d: Date) {
 const mm = String(d.getMonth() + 1).padStart(2, '0')
 const dd = String(d.getDate()).padStart(2, '0')
 const yyyy = d.getFullYear()
 return `${mm}%2F${dd}%2F${yyyy}`
}

function isoDate(d: Date) {
 return d.toISOString().split('T')[0]
}

const NBA_HEADERS = {
 "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
 "Referer": "https://www.nba.com",
 "Accept": "application/json",
 "x-nba-stats-origin": "stats",
 "x-nba-stats-token": "true",
}

const ESPN_ABBR_MAP: Record<string, string> = {
 "NY": "NYK", "GS": "GSW", "SA": "SAS",
 "NO": "NOP", "UTH": "UTA", "UTAH": "UTA",
}
function normalizeAbbr(abbr: string) {
 return ESPN_ABBR_MAP[abbr] ?? abbr
}

type GameRow = {
 id: string
 league_id: string
 game_date: string
 season: string
 home_team_id: string
 away_team_id: string
 home_score: number
 away_score: number
 status: string
}

async function fetchGamesForDate(date: Date, teamByAbbr: Record<string, string>, existingGames: {id: string, home_team_id: string, away_team_id: string, game_date: string}[] = []): Promise<GameRow[]> {
 const iso = isoDate(date)

 try {
   const res = await fetch(
     `https://stats.nba.com/stats/scoreboardV2?DayOffset=0&LeagueID=00&gameDate=${nbaDateFmt(date)}`,
     { headers: NBA_HEADERS, signal: AbortSignal.timeout(8000) }
   )
   if (res.ok) {
     const data = await res.json()
     const gameHeader = data.resultSets?.find((r: any) => r.name === "GameHeader")
     const lineScore = data.resultSets?.find((r: any) => r.name === "LineScore")
     if (gameHeader?.rowSet?.length) {
       const lsH: string[] = lineScore?.headers ?? []
       const lsPtsIdx = lsH.indexOf("PTS")
       const lsGameIdIdx = lsH.indexOf("GAME_ID")
       const lsTeamIdIdx = lsH.indexOf("TEAM_ID")
       const scoresByGame: Record<string, { teamId: string; pts: number }[]> = {}
       for (const row of lineScore?.rowSet ?? []) {
         const gid = row[lsGameIdIdx]
         if (!scoresByGame[gid]) scoresByGame[gid] = []
         scoresByGame[gid].push({ teamId: String(row[lsTeamIdIdx]), pts: row[lsPtsIdx] ?? 0 })
       }
       const ghH: string[] = gameHeader.headers ?? []
       const ghGameIdIdx = ghH.indexOf("GAME_ID")
       const ghHomeIdx = ghH.indexOf("HOME_TEAM_ID")
       const ghAwayIdx = ghH.indexOf("VISITOR_TEAM_ID")
       const ghStatusIdx = ghH.indexOf("GAME_STATUS_TEXT")
       const games: GameRow[] = []
       for (const row of gameHeader.rowSet) {
         const gameId = row[ghGameIdIdx]
         const homeExtId = String(row[ghHomeIdx])
         const awayExtId = String(row[ghAwayIdx])
         const scores = scoresByGame[gameId] ?? []
         const homeScore = scores.find((s: any) => s.teamId === homeExtId)?.pts ?? 0
         const awayScore = scores.find((s: any) => s.teamId === awayExtId)?.pts ?? 0
         if (homeScore === 0 && awayScore === 0) continue
         games.push({
           id: `nba-game-${gameId}`,
           league_id: "nba-2025-26",
           game_date: iso,
           season: "2025-26",
           home_team_id: `nba-team-${homeExtId}`,
           away_team_id: `nba-team-${awayExtId}`,
           home_score: homeScore,
           away_score: awayScore,
           status: row[ghStatusIdx] ?? "Final",
         })
       }
       if (games.length) {
         console.log(`  ${iso}: NBA API — ${games.length} games`)
         return games
       }
     }
   }
 } catch { /* fall through */ }

 try {
   const res = await fetch(
     `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${espnDateFmt(date)}`,
     { signal: AbortSignal.timeout(8000) }
   )
   if (!res.ok) return []
   const data = await res.json()
   const events = data.events ?? []
   if (!events.length) return []
   const games: GameRow[] = []
   for (const event of events) {
     const comp = event.competitions?.[0]
     if (!comp) continue
     const competitors = comp.competitors ?? []
     const home = competitors.find((c: any) => c.homeAway === "home")
     const away = competitors.find((c: any) => c.homeAway === "away")
     if (!home || !away) continue
     const homeAbbr = normalizeAbbr(home.team.abbreviation)
     const awayAbbr = normalizeAbbr(away.team.abbreviation)
     const homeTeamId = teamByAbbr[homeAbbr]
     const awayTeamId = teamByAbbr[awayAbbr]
     if (!homeTeamId || !awayTeamId) {
       console.log(`  ${iso}: unknown abbr home=${homeAbbr} away=${awayAbbr}`)
       continue
     }
     const homeScore = parseInt(home.score ?? "0")
     const awayScore = parseInt(away.score ?? "0")
     if (homeScore === 0 && awayScore === 0) continue
     games.push({
       id: `nba-espn-${event.id}`,
       league_id: "nba-2025-26",
       game_date: iso,
       season: "2025-26",
       home_team_id: homeTeamId,
       away_team_id: awayTeamId,
       home_score: homeScore,
       away_score: awayScore,
       status: comp.status?.type?.description ?? "Final",
     })
   }
   if (games.length) console.log(`  ${iso}: ESPN — ${games.length} games`)
   return games
 } catch (e: any) {
   console.log(`  ${iso}: ESPN error — ${e.message}`)
   return []
 }
}

async function main() {
 const startDate = process.argv[2] ?? "2026-05-13"
 const endDate = process.argv[3] ?? "2026-06-05"
 console.log(`Backfilling ${startDate} to ${endDate}`)

 const { data: players } = await supabase
   .from("pro_players")
   .select("id, external_id, current_team_id")
   .not("external_id", "is", null)

 const playerMap: Record<string, { id: string; team_id: string }> = {}
 for (const p of players ?? []) {
   if (p.external_id) playerMap[p.external_id] = { id: p.id, team_id: p.current_team_id }
 }
 console.log(`Player map: ${Object.keys(playerMap).length}`)

 const { data: teams } = await supabase
   .from("pro_teams")
   .select("id, abbreviation")
   .eq("league_id", "nba-2025-26")

 const teamByAbbr: Record<string, string> = {}
 for (const t of teams ?? []) {
   if (t.abbreviation) teamByAbbr[t.abbreviation] = t.id
 }

 const dates = dateRange(startDate, endDate)
 let totalGames = 0
 let totalStats = 0

 for (const date of dates) {
   const iso = isoDate(date)
   const iso2 = isoDate(date)
  const { data: existingGames } = await supabase
    .from('pro_games')
    .select('id, home_team_id, away_team_id, game_date')
    .eq('game_date', iso2)
    .eq('league_id', 'nba-2025-26')
  const games = await fetchGamesForDate(date, teamByAbbr, existingGames ?? [])
   if (!games.length) { console.log(`  ${iso}: no games`); await sleep(300); continue }

   const { error } = await supabase.from("pro_games").upsert(games, { onConflict: "id" })
   if (error) { console.log(`  ${iso}: upsert error: ${error.message}`); continue }
   totalGames += games.length

   const nbaGameIds = games
     .filter(g => g.id.startsWith("nba-game-"))
     .map(g => g.id.replace("nba-game-", ""))

   const allStats: any[] = []
   for (const gameId of nbaGameIds) {
     try {
       const boxRes = await fetch(
         `https://stats.nba.com/stats/boxscoretraditionalv2?GameID=${gameId}&StartPeriod=0&EndPeriod=10&StartRange=0&EndRange=28800&RangeType=0`,
         { headers: NBA_HEADERS, signal: AbortSignal.timeout(8000) }
       )
       if (!boxRes.ok) continue
       const boxData = await boxRes.json()
       const playerStats = boxData.resultSets?.find((r: any) => r.name === "PlayerStats")
       if (!playerStats) continue
       const h: string[] = playerStats.headers
       for (const row of playerStats.rowSet) {
         const r: Record<string, any> = {}
         h.forEach((key: string, idx: number) => r[key] = row[idx])
         const externalId = String(r.PLAYER_ID)
         const mapped = playerMap[externalId]
         if (!mapped) continue
         const matchupParts = (r.MATCHUP as string ?? "").split(/\s+(?:vs\.|@)\s+/)
         const opponentAbbr = matchupParts[1]?.trim()
         allStats.push({
           id: `nba-gamelog-${externalId}-${gameId}`,
           player_id: mapped.id,
           team_id: mapped.team_id,
           opponent_id: teamByAbbr[opponentAbbr] ?? null,
           league_id: "nba-2025-26",
           season: "2025-26",
           game_date: iso,
           game_id: `nba-game-${gameId}`,
           pts: r.PTS ?? 0, reb: r.REB ?? 0, ast: r.AST ?? 0,
           stl: r.STL ?? 0, blk: r.BLK ?? 0, tov: r.TO ?? 0,
           fgm: r.FGM ?? 0, fga: r.FGA ?? 0,
           three_pm: r.FG3M ?? 0, three_pa: r.FG3A ?? 0,
           ftm: r.FTM ?? 0, fta: r.FTA ?? 0,
           minutes: r.MIN ?? "0",
         })
       }
       await sleep(400)
     } catch { /* blocked */ }
   }

   if (allStats.length) {
     for (let i = 0; i < allStats.length; i += 500) {
       const { error: se } = await supabase
         .from("pro_game_stats")
         .upsert(allStats.slice(i, i + 500), { onConflict: "id" })
       if (!se) totalStats += Math.min(500, allStats.length - i)
     }
     console.log(`  ${iso}: ${allStats.length} player stats`)
   }
   await sleep(500)
 }

 console.log(`Done. ${totalGames} games, ${totalStats} player stats.`)
}

main().catch(console.error)
