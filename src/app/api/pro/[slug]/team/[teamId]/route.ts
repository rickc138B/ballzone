import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; teamId: string }> }
) {
  try {
    const { slug, teamId } = await params
    const supabase = createServiceClient()

    const { data: league } = await supabase
      .from('pro_leagues')
      .select('id')
      .eq('slug', slug)
      .single()

    if (!league) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: team } = await supabase
      .from('pro_teams')
      .select('*')
      .eq('id', teamId)
      .single()

    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

    // Roster — players with season stats for this team
    const { data: roster } = await supabase
      .from('pro_player_seasons')
      .select('pts, reb, ast, stl, blk, games_played, fg_pct, three_pct, player:pro_players(id, name, photo_url, nationality)')
      .eq('league_id', league.id)
      .eq('team_id', teamId)
      .order('pts', { ascending: false })

    // Games involving this team
    const { data: games } = await supabase
      .from('pro_games')
      .select(`
        id, game_date, home_score, away_score,
        home_team:pro_teams!pro_games_home_team_id_fkey(id, name, abbreviation),
        away_team:pro_teams!pro_games_away_team_id_fkey(id, name, abbreviation)
      `)
      .eq('league_id', league.id)
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .order('game_date', { ascending: false })
      .limit(20)

    // Compute record
    const record = { w: 0, l: 0, pts_for: 0, pts_against: 0 }
    const gameSummaries = (games ?? []).map(g => {
      const isHome = (g.home_team as any)?.id === teamId
      const team_score = isHome ? g.home_score : g.away_score
      const opp_score = isHome ? g.away_score : g.home_score
      const opponent = isHome ? (g.away_team as any) : (g.home_team as any)
      const won = team_score > opp_score
      record.pts_for += team_score ?? 0
      record.pts_against += opp_score ?? 0
      if (won) record.w++; else record.l++
      return {
        id: g.id,
        game_date: g.game_date,
        opponent_name: opponent?.name,
        opponent_abbr: opponent?.abbreviation,
        team_score,
        opp_score,
        won,
      }
    })

    return NextResponse.json({
      team,
      record: { ...record, gp: record.w + record.l },
      roster: (roster ?? []).map(r => ({
        id: (r.player as any)?.id,
        name: (r.player as any)?.name,
        photo_url: (r.player as any)?.photo_url ?? null,
        nationality: (r.player as any)?.nationality ?? null,
        pts: r.pts, reb: r.reb, ast: r.ast,
        stl: r.stl, blk: r.blk,
        games_played: r.games_played,
        fg_pct: r.fg_pct, three_pct: r.three_pct,
      })),
      games: gameSummaries,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
