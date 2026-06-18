import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import bcrypt from 'bcryptjs'

async function checkPin(supabase: any, leagueId: string, pin: string) {
  const { data: league } = await supabase
    .from('leagues').select('admin_pin_hash').eq('id', leagueId).single()
  if (!league) return false
  if (!league.admin_pin_hash) return true
  return bcrypt.compare(pin?.trim() ?? '', league.admin_pin_hash)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  try {
    const { gameId } = await params
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('game_score_events')
      .select('id, team, pts, created_at')
      .eq('league_game_id', gameId)
      .eq('voided', false)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ events: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  try {
    const { id: leagueId, gameId } = await params
    const { pin, team, pts } = await req.json()

    if (!['home', 'away'].includes(team) || ![1, 2, 3].includes(pts))
      return NextResponse.json({ error: 'Invalid event' }, { status: 400 })

    const supabase = createServiceClient()
    if (!(await checkPin(supabase, leagueId, pin)))
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 403 })

    const { data, error } = await supabase
      .from('game_score_events')
      .insert({ league_game_id: gameId, team, pts })
      .select('id, team, pts, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ event: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  try {
    const { id: leagueId, gameId } = await params
    const { pin, eventId } = await req.json()

    const supabase = createServiceClient()
    if (!(await checkPin(supabase, leagueId, pin)))
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 403 })

    let query = supabase
      .from('game_score_events')
      .update({ voided: true, voided_at: new Date().toISOString() })
      .eq('league_game_id', gameId)
      .eq('voided', false)

    if (eventId) {
      query = query.eq('id', eventId)
    } else {
      const { data: last } = await supabase
        .from('game_score_events')
        .select('id')
        .eq('league_game_id', gameId)
        .eq('voided', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (!last) return NextResponse.json({ error: 'No events to undo' }, { status: 404 })
      query = query.eq('id', last.id)
    }

    const { error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
