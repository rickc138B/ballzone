import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; season: string }> }
) {
  try {
    const { slug, season: seasonSlug } = await params
    const supabase = createServiceClient()

    const { data: league, error: leagueErr } = await supabase
      .from('pro_leagues')
      .select('*')
      .eq('slug', slug)
      .single()

    if (leagueErr || !league) return NextResponse.json({ error: 'League not found' }, { status: 404 })

    // resolve season: 'current' keyword, or an explicit slug
    let seasonQuery = supabase
      .from('pro_seasons')
      .select('*')
      .eq('league_id', league.id)

    seasonQuery = seasonSlug === 'current'
      ? seasonQuery.eq('is_current', true)
      : seasonQuery.eq('slug', seasonSlug)

    const { data: season, error: seasonErr } = await seasonQuery.single()

    if (seasonErr || !season) return NextResponse.json({ error: 'Season not found' }, { status: 404 })

    // all seasons for this league, for the season switcher UI
    const { data: allSeasons } = await supabase
      .from('pro_seasons')
      .select('id, label, slug, is_current, start_date, end_date')
      .eq('league_id', league.id)
      .order('start_date', { ascending: false })

    const { data: players } = await supabase
      .from('pro_player_seasons')
      .select('*, player:pro_players(id, name, nationality, photo_url), team:pro_teams(id, name, abbreviation)')
      .eq('season_id', season.id)
      .order('pts', { ascending: false })
      .limit(100)

    const { data: teams } = await supabase
      .from('pro_teams')
      .select('*')
      .eq('league_id', league.id)
      .order('name')

    const { data: standings } = await supabase
      .from('pro_team_seasons')
      .select('*, team:pro_teams(id, name, conference, is_dq)')
      .eq('season_id', season.id)
      .order('win_pct', { ascending: false, nullsFirst: false })

    return NextResponse.json({
      league,
      season,
      seasons: allSeasons ?? [],
      players: players ?? [],
      teams: teams ?? [],
      standings: standings ?? [],
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 })
  }
}
