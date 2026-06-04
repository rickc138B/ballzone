import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  try {
    const { id: leagueId, gameId } = await params
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('league_games')
      .select(`
        id, status, round_label, played_at, home_score, away_score, recap_image_url, location_name,
        league:leagues!league_games_league_id_fkey(title),
        home_team:league_teams!league_games_home_team_id_fkey(id, name),
        away_team:league_teams!league_games_away_team_id_fkey(id, name)
      `)
      .eq('id', gameId)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Fetch player stats for each team
    const { data: stats } = await supabase
      .from('player_game_stats')
      .select('*, league_players(display_name)')
      .eq('league_game_id', gameId)

    const flatten = (s: any) => ({ ...s, display_name: s.league_players?.display_name ?? s.display_name ?? "Unknown" })
    const homePlayers = (stats ?? []).filter((s: any) => s.league_team_id === (data.home_team as any).id).map(flatten)
    const awayPlayers = (stats ?? []).filter((s: any) => s.league_team_id === (data.away_team as any).id).map(flatten)

    return NextResponse.json({
      ...data,
      home_team: { ...(data.home_team as any), score: data.home_score ?? 0, players: homePlayers },
      away_team: { ...(data.away_team as any), score: data.away_score ?? 0, players: awayPlayers },
    })
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  try {
    const { id: leagueId, gameId } = await params
    const { pin, status, home_score, away_score, recap_image_url } = await req.json()

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

    const updates: Record<string, any> = {}
    if (status !== undefined) updates.status = status
    if (home_score !== undefined) updates.home_score = home_score
    if (away_score !== undefined) updates.away_score = away_score
    if (recap_image_url !== undefined) updates.recap_image_url = recap_image_url
    if (status === 'complete') updates.played_at = new Date().toISOString()

    const { error } = await supabase
      .from('league_games').update(updates).eq('id', gameId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
