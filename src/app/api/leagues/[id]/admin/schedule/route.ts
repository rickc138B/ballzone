import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import bcrypt from 'bcryptjs'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leagueId } = await params
    const { pin, home_team, away_team, scheduled_at, location_name, round_label } = await req.json()

    if (!pin?.trim()) return NextResponse.json({ error: 'PIN required' }, { status: 400 })
    if (!home_team?.trim() || !away_team?.trim() || !scheduled_at)
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const supabase = createServiceClient()

    // Verify PIN
    const { data: league, error: leagueErr } = await supabase
      .from('leagues')
      .select('admin_pin_hash')
      .eq('id', leagueId)
      .single()

    if (leagueErr || !league) return NextResponse.json({ error: 'League not found' }, { status: 404 })
    if (league.admin_pin_hash) {
      const valid = await bcrypt.compare(pin.trim(), league.admin_pin_hash)
      if (!valid) return NextResponse.json({ error: 'Invalid admin PIN' }, { status: 403 })
    }

    // Next sequence number
    const { data: existing } = await supabase
      .from('league_games')
      .select('sequence_number')
      .eq('league_id', leagueId)
      .order('sequence_number', { ascending: false })
      .limit(1)
    const nextSeq = (existing?.[0]?.sequence_number ?? 0) + 1

    // Get or create team
    async function getOrCreateTeam(name: string) {
      const { data: existing } = await supabase
        .from('league_teams')
        .select('id')
        .eq('league_id', leagueId)
        .eq('name', name)
        .maybeSingle()
      if (existing) return existing.id
      const { data: created } = await supabase
        .from('league_teams')
        .insert({ league_id: leagueId, name })
        .select('id')
        .single()
      return created?.id
    }

    const homeTeamId = await getOrCreateTeam(home_team.trim())
    const awayTeamId = await getOrCreateTeam(away_team.trim())

    if (!homeTeamId || !awayTeamId)
      return NextResponse.json({ error: 'Failed to resolve teams' }, { status: 500 })

    const { data: game, error: gameErr } = await supabase
      .from('league_games')
      .insert({
        league_id: leagueId,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        played_at: scheduled_at,
        location_name: location_name?.trim() || null,
        round_label: round_label?.trim() || null,
        sequence_number: nextSeq,
        status: 'scheduled',
      })
      .select('id')
      .single()

    if (gameErr) {
      console.error(gameErr)
      return NextResponse.json({ error: gameErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, gameId: game.id })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
