import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const { id: leagueId, teamId } = await params
    const supabase = createServiceClient()

    const { data: team, error } = await supabase
      .from('league_teams')
      .select('id, name, logo_url, description, home_court, instagram_url, twitter_url, founded_year, primary_color')
      .eq('id', teamId)
      .single()

    if (error || !team) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Get roster
    const { data: players } = await supabase
      .from('league_players')
      .select('id, display_name, jersey_number, photo_url, claimed_by')
      .eq('league_team_id', teamId)
      .order('display_name')

    // Get games involving this team
    const { data: games } = await supabase
      .from('league_games')
      .select(`
        id, round_label, played_at, home_score, away_score, status,
        home_team:league_teams!league_games_home_team_id_fkey(id, name),
        away_team:league_teams!league_games_away_team_id_fkey(id, name)
      `)
      .eq('league_id', leagueId)
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .order('played_at', { ascending: false })
      .limit(20)

    // Compute record
    let wins = 0, losses = 0, ptsFor = 0, ptsAgainst = 0
    for (const g of games ?? []) {
      if (g.home_score === null || g.away_score === null) continue
      const isHome = (g.home_team as any)?.id === teamId
      const teamScore = isHome ? g.home_score : g.away_score
      const oppScore = isHome ? g.away_score : g.home_score
      ptsFor += teamScore
      ptsAgainst += oppScore
      if (teamScore > oppScore) wins++
      else losses++
    }

    // Get season stats per player
    const { data: stats } = await supabase
      .from('player_game_stats')
      .select('league_player_id, pts, reb, ast, stl, blk')
      .eq('league_team_id', teamId)

    const playerStats: Record<string, { pts: number; reb: number; ast: number; stl: number; blk: number; gp: number }> = {}
    for (const s of stats ?? []) {
      if (!playerStats[s.league_player_id]) {
        playerStats[s.league_player_id] = { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, gp: 0 }
      }
      playerStats[s.league_player_id].pts += s.pts ?? 0
      playerStats[s.league_player_id].reb += s.reb ?? 0
      playerStats[s.league_player_id].ast += s.ast ?? 0
      playerStats[s.league_player_id].stl += s.stl ?? 0
      playerStats[s.league_player_id].blk += s.blk ?? 0
      playerStats[s.league_player_id].gp += 1
    }

    return NextResponse.json({
      team,
      players: players ?? [],
      games: games ?? [],
      record: { wins, losses, ptsFor, ptsAgainst },
      playerStats,
    })
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const { id: leagueId, teamId } = await params
    const { pin, ...updates } = await req.json()

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

    const allowed = ['logo_url', 'description', 'home_court', 'instagram_url', 'twitter_url', 'founded_year', 'primary_color']
    const filtered = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)))

    const { error } = await supabase.from('league_teams').update(filtered).eq('id', teamId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
