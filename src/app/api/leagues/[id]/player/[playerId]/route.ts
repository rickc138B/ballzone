import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; playerId: string }> }
) {
  try {
    const { playerId } = await params
    const supabase = createServiceClient()

    const { data: player, error } = await supabase
      .from('league_players')
      .select('id, display_name, photo_url, league_team_id, claimed_by, league_teams(name, league_id)')
      .eq('id', playerId)
      .single()

    if (error || !player) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: stats } = await supabase
      .from('player_game_stats')
      .select(`
        pts, reb, ast, blk, stl, tov, fga, fgm, three_pa, three_pm, fta, ftm,
        league_games!player_game_stats_league_game_id_fkey(
          id, round_label, played_at, home_score, away_score,
          home_team:league_teams!league_games_home_team_id_fkey(id, name),
          away_team:league_teams!league_games_away_team_id_fkey(id, name)
        )
      `)
      .eq('league_player_id', playerId)
      .order('created_at', { ascending: false })

    if (!stats || stats.length === 0) {
      return NextResponse.json({
        player: { id: player.id, display_name: player.display_name, photo_url: (player as any).photo_url ?? null, team_name: (player.league_teams as any)?.name, claimed_by: player.claimed_by ?? null },
        averages: null,
        career_high: null,
        game_log: [],
      })
    }

    // Averages
    const gp = stats.length
    const sum = stats.reduce((acc, s) => ({
      pts: acc.pts + s.pts, reb: acc.reb + s.reb, ast: acc.ast + s.ast,
      stl: acc.stl + s.stl, blk: acc.blk + s.blk, tov: acc.tov + s.tov,
      fgm: acc.fgm + s.fgm, fga: acc.fga + s.fga,
      three_pm: acc.three_pm + s.three_pm, three_pa: acc.three_pa + s.three_pa,
      ftm: acc.ftm + s.ftm, fta: acc.fta + s.fta,
    }), { pts:0,reb:0,ast:0,stl:0,blk:0,tov:0,fgm:0,fga:0,three_pm:0,three_pa:0,ftm:0,fta:0 })

    const avg = (n: number) => parseFloat((n / gp).toFixed(1))
    const pct = (m: number, a: number) => a > 0 ? parseFloat(((m / a) * 100).toFixed(1)) : 0

    const averages = {
      gp,
      ppg: avg(sum.pts), rpg: avg(sum.reb), apg: avg(sum.ast),
      spg: avg(sum.stl), bpg: avg(sum.blk), tpg: avg(sum.tov),
      fg_pct: pct(sum.fgm, sum.fga),
      three_pct: pct(sum.three_pm, sum.three_pa),
      ft_pct: pct(sum.ftm, sum.fta),
    }

    const careerHigh = stats.reduce((best, s) => s.pts > best.pts ? s : best, stats[0])

    const game_log = stats.map(s => {
      const g = s.league_games as any
      const homeTeam = g?.home_team
      const awayTeam = g?.away_team
      return {
        game_id: g?.id,
        round_label: g?.round_label,
        played_at: g?.played_at,
        home_team: homeTeam?.name,
        away_team: awayTeam?.name,
        home_score: g?.home_score,
        away_score: g?.away_score,
        pts: s.pts, reb: s.reb, ast: s.ast, stl: s.stl, blk: s.blk, tov: s.tov,
        fgm: s.fgm, fga: s.fga, three_pm: s.three_pm, three_pa: s.three_pa,
        ftm: s.ftm, fta: s.fta,
      }
    })

    const careerHighGame = game_log[stats.indexOf(careerHigh)]

    return NextResponse.json({
      player: { id: player.id, display_name: player.display_name, photo_url: (player as any).photo_url ?? null, team_name: (player.league_teams as any)?.name, claimed_by: player.claimed_by ?? null },
      averages,
      career_high: { pts: careerHigh.pts, reb: careerHigh.reb, ast: careerHigh.ast, game: careerHighGame },
      game_log,
    })
  } catch (err) {
    console.error('Player profile error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; playerId: string }> }
) {
  try {
    const { playerId } = await params
    const { photo_url, fingerprint, pin } = await req.json()
    if (!photo_url) return NextResponse.json({ error: 'Missing photo_url' }, { status: 400 })

    const supabase = createServiceClient()

    if (pin) {
      // Admin path — verify PIN against league
      const { id: leagueId } = await params
      const bcrypt = await import('bcryptjs')
      const { data: league } = await supabase
        .from('leagues').select('admin_pin_hash').eq('id', leagueId).single()
      if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 })
      if (league.admin_pin_hash) {
        const valid = await bcrypt.default.compare(pin.trim(), league.admin_pin_hash)
        if (!valid) return NextResponse.json({ error: 'Invalid PIN' }, { status: 403 })
      }
    } else {
      // Player path — verify fingerprint owns this player
      if (!fingerprint) return NextResponse.json({ error: 'Missing auth' }, { status: 400 })
      const { data: player } = await supabase
        .from('league_players')
        .select('claimed_by')
        .eq('id', playerId)
        .single()
      if (!player || player.claimed_by !== fingerprint)
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const { error } = await supabase
      .from('league_players')
      .update({ photo_url })
      .eq('id', playerId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
