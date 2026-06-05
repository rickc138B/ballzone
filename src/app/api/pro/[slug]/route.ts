import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const supabase = createServiceClient()

    const { data: league, error } = await supabase
      .from('pro_leagues')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error || !league) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: players } = await supabase
      .from('pro_player_seasons')
      .select('*, player:pro_players(id, name, nationality, photo_url), team:pro_teams(id, name, abbreviation)')
      .eq('league_id', league.id)
      .order('pts', { ascending: false })
      .limit(100)

    const { data: teams } = await supabase
      .from('pro_teams')
      .select('*')
      .eq('league_id', league.id)
      .order('name')

    return NextResponse.json({ league, players: players ?? [], teams: teams ?? [] })
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
