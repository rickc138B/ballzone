import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

// POST: save per-player stats after a live game
// Body: { pin, home_team_id, away_team_id, players: [{ name, team_id, pts, reb, ast, stl, blk, tov }] }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  try {
    const { id: leagueId, gameId } = await params
    const { pin, players } = await req.json()

    if (!pin?.trim()) return NextResponse.json({ error: 'PIN required' }, { status: 400 })

    const supabase = createServiceClient()

    const { data: league } = await supabase
      .from('leagues').select('admin_pin_hash').eq('id', leagueId).single()
    if (!league) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (league.admin_pin_hash) {
      const bcrypt = require('bcryptjs')
      const valid = await bcrypt.compare(pin.trim(), league.admin_pin_hash)
      if (!valid) return NextResponse.json({ error: 'Invalid PIN' }, { status: 403 })
    }

    // Upsert players and insert stats
    for (const p of players ?? []) {
      if (!p.name?.trim() || !p.team_id) continue

      // Get or create league_player
      let { data: player } = await supabase
        .from('league_players')
        .select('id')
        .eq('league_team_id', p.team_id)
        .ilike('display_name', p.name.trim())
        .maybeSingle()

      if (!player) {
        const { data: created } = await supabase
          .from('league_players')
          .insert({ league_team_id: p.team_id, display_name: p.name.trim() })
          .select('id').single()
        player = created
      }

      if (!player) continue

      await supabase.from('player_game_stats').upsert({
        league_game_id: gameId,
        league_player_id: player.id,
        league_team_id: p.team_id,
        pts: p.pts ?? 0,
        reb: p.reb ?? 0,
        ast: p.ast ?? 0,
        stl: p.stl ?? 0,
        blk: p.blk ?? 0,
        tov: p.tov ?? 0,
        fga: p.fga ?? 0, fgm: p.fgm ?? 0,
        three_pa: p.three_pa ?? 0, three_pm: p.three_pm ?? 0,
        fta: p.fta ?? 0, ftm: p.ftm ?? 0,
      }, { onConflict: 'league_game_id,league_player_id' })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
