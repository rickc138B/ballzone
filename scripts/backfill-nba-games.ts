import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
 process.env.NEXT_PUBLIC_SUPABASE_URL!,
 process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function main() {
 const startDate = process.argv[2] ?? '2026-04-10'
 const endDate = process.argv[3] ?? '2026-06-04'

 console.log(`Backfilling ${startDate} → ${endDate}`)

 // Build maps
 const { data: players } = await supabase
   .from('pro_players')
   .select('id, external_id, current_team_id')
   .not('external_id', 'is', null)

 const playerMap: Record<string, { id: string; team_id: string }> = {}
 for (const p of players ?? []) {
   if (p.external_id) playerMap[p.external_id] = { id: p.id, team_id: p.current_team_id }
 }
 console.log(`Player map: ${Object.keys(playerMap).length} players`)

 const { data: teams } = await supabase
   .from('pro_teams')
   .select('id, abbreviation')
   .eq('league_id', 'nba-2025-26')

 const teamByAbbr: Record<string, string> = {}
 for (const t of teams ?? []) {
   if (t.abbreviation) teamByAbbr[t.abbreviation] = t.id
 }
 const teamIdFromExternal = (extId: string) => `nba-team-${extId}`

 const dates = dateRange(startDate, endDate)
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
     if (!sbRes.ok) { console.log(`${iso}: scoreboard ${sbRes.status}`); continue }

     const sbData = await sbRes.json()
     const gameHeader = sbData.resultSets?.find((r: any) => r.name === 'GameHeader')
     const lineScore = sbData.resultSets?.find((r: any) => r.name === 'LineScore')

     if (!gameHeader?.rowSet?.length) { console.log(`${iso}: no games`); continue }

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
       const homeScore = scores.find((s: any) => s.teamId === homeExtId)?.pts ?? 0
       const awayScore = scores.find((s: any) => s.teamId === awayExtId)?.pts ?? 0
       if (homeScore === 0 && awayScore === 0) continue

       proGames.push({
         id: `nba-game-${gameId}`,
         league_id: 'nba-2025-26',
         game_date: iso,
         home_team_id: teamIdFromExternal(homeExtId),
         away_team_id: teamIdFromExternal(awayExtId),
         home_score: homeScore,
         away_score: awayScore,
         status,
         season: '2025-26',
       })
       gameIds.push(gameId)
     }

     if (proGames.length) {
       const { error } = await supabase.from('pro_games').upsert(proGames, { onConflict: 'id' })
       if (error) console.log(`${iso}: pro_games error: ${error.message}`)
       else { totalGames += proGames.length; console.log(`${iso}: ${proGames.length} games upserted`) }
     }

     const allStats: any[] = []
     for (const gameId of gameIds) {
       try {
         const boxRes = await fetch(
           `https://stats.nba.com/stats/boxscoretraditionalv2?GameID=${gameId}&StartPeriod=0&EndPeriod=10&StartRange=0&EndRange=28800&RangeType=0`,
           { headers: NBA_HEADERS }
         )
         if (!boxRes.ok) { console.log(`  box score failed ${gameId}: ${boxRes.status}`); continue }

         const boxData = await boxRes.json()
         const playerStats = boxData.resultSets?.find((r: any) => r.name === 'PlayerStats')
         if (!playerStats) continue

         const h: string[] = playerStats.headers
         for (const row of playerStats.rowSet) {
           const r: Record<string, any> = {}
           h.forEach((key: string, idx: number) => r[key] = row[idx])

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
         await sleep(400)
       } catch (e: any) {
         console.log(`  error on ${gameId}: ${e.message}`)
       }
     }

     if (allStats.length) {
       for (let i = 0; i < allStats.length; i += 500) {
         const { error } = await supabase
           .from('pro_game_stats')
           .upsert(allStats.slice(i, i + 500), { onConflict: 'id' })
         if (!error) totalStats += Math.min(500, allStats.length - i)
       }
       console.log(`  ${allStats.length} player stats upserted`)
     }

     await sleep(600)
   } catch (e: any) {
     console.log(`${iso}: error — ${e.message}`)
   }
 }

 console.log(`\nDone. ${totalGames} games, ${totalStats} player stats.`)
}

main().catch(console.error)
