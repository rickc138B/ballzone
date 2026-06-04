import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import bcrypt from 'bcryptjs'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leagueId } = await params
    const { pin } = await req.json()

    if (!pin?.trim()) return NextResponse.json({ error: 'PIN required' }, { status: 400 })

    const supabase = createServiceClient()

    const { data: league } = await supabase
      .from('leagues').select('admin_pin_hash').eq('id', leagueId).single()

    if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 })

    if (league.admin_pin_hash) {
      const valid = await bcrypt.compare(pin.trim(), league.admin_pin_hash)
      if (!valid) return NextResponse.json({ error: 'Invalid PIN' }, { status: 403 })
    }

    // league_players has no league_id — must join through league_teams
    const { data: teams } = await supabase
      .from('league_teams')
      .select('id')
      .eq('league_id', leagueId)

    const teamIds = (teams ?? []).map(t => t.id)

    const { data: players, error } = await supabase
      .from('league_players')
      .select('id, display_name, claim_code, claimed_by, claimed_at, league_teams(name)')
      .in('league_team_id', teamIds.length ? teamIds : ['none'])
      .order('display_name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(
      (players ?? []).map(p => ({
        id: p.id,
        display_name: p.display_name,
        team_name: (p.league_teams as any)?.name ?? 'Unknown',
        claim_code: p.claim_code,
        claimed_by: p.claimed_by ?? null,
        claimed_at: p.claimed_at ?? null,
      }))
    )
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
