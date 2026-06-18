import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leagueId } = await params
    const supabase = createServiceClient()

    // Get all teams in this league
    const { data: teams } = await supabase
      .from('league_teams')
      .select('id, name')
      .eq('league_id', leagueId)

    const teamIds = (teams ?? []).map(t => t.id)
    if (!teamIds.length) return NextResponse.json([])

    const teamMap = Object.fromEntries((teams ?? []).map(t => [t.id, t.name]))

    // Get all player_game_stats for this league's teams
    const { data: stats, error } = await supabase
      .from('player_game_stats')
      .select('league_player_id, league_team_id, pts, reb, ast, stl, blk, tov, fga, fgm, three_pa, three_pm, fta, ftm, league_players(display_name, photo_url)')
      .in('league_team_id', teamIds)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Aggregate per player
    const agg: Record<string, {
      player_id: string
      display_name: string
      photo_url: string | null
      team_id: string
      team_name: string
      gp: number
      pts: number; reb: number; ast: number; stl: number; blk: number; tov: number
      fga: number; fgm: number; three_pa: number; three_pm: number; fta: number; ftm: number
    }> = {}

    for (const s of stats ?? []) {
      const pid = s.league_player_id
      const player = s.league_players as any
      if (!agg[pid]) {
        agg[pid] = {
          player_id: pid,
          display_name: player?.display_name ?? 'Unknown',
          photo_url: player?.photo_url ?? null,
          team_id: s.league_team_id,
          team_name: teamMap[s.league_team_id] ?? 'Unknown',
          gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0,
          fga: 0, fgm: 0, three_pa: 0, three_pm: 0, fta: 0, ftm: 0,
        }
      }
      agg[pid].gp++
      agg[pid].pts += s.pts ?? 0
      agg[pid].reb += s.reb ?? 0
      agg[pid].ast += s.ast ?? 0
      agg[pid].stl += s.stl ?? 0
      agg[pid].blk += s.blk ?? 0
      agg[pid].tov += s.tov ?? 0
      agg[pid].fga += s.fga ?? 0
      agg[pid].fgm += s.fgm ?? 0
      agg[pid].three_pa += s.three_pa ?? 0
      agg[pid].three_pm += s.three_pm ?? 0
      agg[pid].fta += s.fta ?? 0
      agg[pid].ftm += s.ftm ?? 0
    }

    const avg = (n: number, gp: number) => gp > 0 ? parseFloat((n / gp).toFixed(1)) : 0
    const pct = (m: number, a: number) => a > 0 ? parseFloat(((m / a) * 100).toFixed(1)) : 0

    const leaderboard = Object.values(agg).map(p => ({
      player_id: p.player_id,
      display_name: p.display_name,
      photo_url: p.photo_url,
      team_name: p.team_name,
      team_id: p.team_id,
      gp: p.gp,
      ppg: avg(p.pts, p.gp),
      rpg: avg(p.reb, p.gp),
      apg: avg(p.ast, p.gp),
      spg: avg(p.stl, p.gp),
      bpg: avg(p.blk, p.gp),
      tpg: avg(p.tov, p.gp),
      fg_pct: pct(p.fgm, p.fga),
      three_pct: pct(p.three_pm, p.three_pa),
      ft_pct: pct(p.ftm, p.fta),
      total_pts: p.pts,
    }))

    return NextResponse.json(leaderboard)
  } catch (err) {
    console.error('leaderboard error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
