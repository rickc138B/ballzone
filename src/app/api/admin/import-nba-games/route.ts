import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

const NBA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://www.nba.com',
  'Accept': 'application/json',
}

export async function POST(req: NextRequest) {
  try {
    const { secret } = await req.json()
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()
    const results: string[] = []

    // Get all players we already imported
    const { data: players, error: playersError } = await supabase
      .from('pro_players')
      .select('id, external_id, current_team_id')
      .not('external_id', 'is', null)

    if (playersError || !players?.length) {
      return NextResponse.json({ error: 'No players found — run import-nba first' }, { status: 400 })
    }

    results.push(`Found ${players.length} players to import game logs for`)

    // Get all pro_teams so we can map abbreviation → id
    const { data: teams } = await supabase
      .from('pro_teams')
      .select('id, abbreviation')
      .eq('league_id', 'nba-2024-25')

    const teamByAbbr: Record<string, string> = {}
    for (const t of teams ?? []) {
      if (t.abbreviation) teamByAbbr[t.abbreviation] = t.id
    }

    const allStats: any[] = []
    let skipped = 0

    // Batch players to avoid hammering the API
    for (let i = 0; i < players.length; i++) {
      const player = players[i]
      if (!player.external_id) continue

      try {
        const url = `https://stats.nba.com/stats/playergamelog?PlayerID=${player.external_id}&Season=2024-25&SeasonType=Regular+Season`
        const res = await fetch(url, { headers: NBA_HEADERS })
        if (!res.ok) { skipped++; continue }

        const data = await res.json()
        const resultSet = data.resultSets?.[0]
        if (!resultSet) { skipped++; continue }

        const headers: string[] = resultSet.headers
        const rows: any[][] = resultSet.rowSet

        for (const row of rows) {
          const r: Record<string, any> = {}
          headers.forEach((h, idx) => r[h] = row[idx])

          // MATCHUP is like "NYK vs. SAS" or "NYK @ SAS"
          const matchupParts = (r.MATCHUP as string).split(/\s+(?:vs\.|@)\s+/)
          const opponentAbbr = matchupParts[1]?.trim()
          const opponentId = teamByAbbr[opponentAbbr] ?? null

          allStats.push({
            id: `nba-gamelog-${player.external_id}-${r.Game_ID}`,
            player_id: player.id,
            team_id: player.current_team_id,
            opponent_id: opponentId,
            league_id: 'nba-2024-25',
            season: '2024-25',
            game_date: r.GAME_DATE
              ? new Date(r.GAME_DATE).toISOString().split('T')[0]
              : null,
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

        // Small delay every 10 players to be polite to the API
        if (i % 10 === 0) await new Promise(r => setTimeout(r, 500))

      } catch {
        skipped++
      }
    }

    results.push(`Built ${allStats.length} game log rows (${skipped} players skipped)`)

    // Upsert in batches of 500
    let upserted = 0
    for (let i = 0; i < allStats.length; i += 500) {
      const batch = allStats.slice(i, i + 500)
      const { error } = await supabase.from('pro_game_stats').upsert(batch, { onConflict: 'id' })
      if (error) results.push(`Batch ${i / 500 + 1} error: ${error.message}`)
      else upserted += batch.length
    }

    results.push(`Upserted ${upserted} rows into pro_game_stats`)

    return NextResponse.json({ success: true, results })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
