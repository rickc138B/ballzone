import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()

    const { data: league, error } = await supabase
      .from('leagues')
      .select('*')
      .eq('id', id)
      .single()
    if (error || !league) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: teams } = await supabase
      .from('league_teams')
      .select('id, name')
      .eq('league_id', id)
      .order('name')

    const { data: games } = await supabase
      .from('league_games')
      .select(`
        id, sequence_number, round_label, played_at, home_score, away_score, status, location_name,
        home_team:league_teams!league_games_home_team_id_fkey(id, name),
        away_team:league_teams!league_games_away_team_id_fkey(id, name)
      `)
      .eq('league_id', id)
      .order('played_at', { ascending: false })

    // Compute standings
    const standings: Record<string, { name: string; w: number; l: number; pts_for: number; pts_against: number }> = {}
    for (const t of teams ?? []) {
      standings[t.id] = { name: t.name, w: 0, l: 0, pts_for: 0, pts_against: 0 }
    }
    for (const g of games ?? []) {
      if (g.status !== 'complete' || g.home_score === null || g.away_score === null) continue
      const hid = (g.home_team as any)?.id
      const aid = (g.away_team as any)?.id
      if (hid && standings[hid]) {
        standings[hid].pts_for += g.home_score
        standings[hid].pts_against += g.away_score
        if (g.home_score > g.away_score) standings[hid].w++
        else standings[hid].l++
      }
      if (aid && standings[aid]) {
        standings[aid].pts_for += g.away_score
        standings[aid].pts_against += g.home_score
        if (g.away_score > g.home_score) standings[aid].w++
        else standings[aid].l++
      }
    }

    const standingsList = Object.entries(standings)
      .map(([id, s]) => ({ id, ...s, gp: s.w + s.l }))
      .sort((a, b) => b.w - a.w || (b.pts_for - b.pts_against) - (a.pts_for - a.pts_against))

    return NextResponse.json({ league, games: games ?? [], standings: standingsList })
  } catch (err) {
    console.error('GET league error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
