import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leagueId } = await params
    const supabase = createServiceClient()

    const { data: teams } = await supabase
      .from('league_teams')
      .select('id, name')
      .eq('league_id', leagueId)
      .order('name')

    const teamIds = (teams ?? []).map(t => t.id)

    const { data: players, error } = await supabase
      .from('league_players')
      .select('id, display_name, photo_url, profile_id, league_team_id')
      .in('league_team_id', teamIds.length ? teamIds : ['none'])
      .order('display_name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const teamMap = Object.fromEntries((teams ?? []).map(t => [t.id, t.name]))

    return NextResponse.json(
      (players ?? []).map(p => ({
        id: p.id,
        display_name: p.display_name,
        photo_url: p.photo_url ?? null,
        team_id: p.league_team_id,
        team_name: teamMap[p.league_team_id] ?? 'Unknown',
        is_claimed: !!p.profile_id,
      }))
    )
  } catch (err) {
    console.error('players route error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
