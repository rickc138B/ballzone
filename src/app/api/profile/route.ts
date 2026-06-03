import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

async function hashToken(token: string): Promise<string> {
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token)
  )
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function getProfileFromRequest(req: NextRequest) {
  const token = req.headers.get('x-profile-token')
  if (!token) return null
  const supabase = createServiceClient()
  const token_hash = await hashToken(token)
  const { data: session } = await supabase
    .from('profile_sessions')
    .select('profile_id')
    .eq('token_hash', token_hash)
    .single()
  if (!session) return null
  await supabase
    .from('profile_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('token_hash', token_hash)
  return session.profile_id as string
}

export async function GET(req: NextRequest) {
  const profile_id = await getProfileFromRequest(req)
  if (!profile_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', profile_id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Stats
  const { count: runs_organised } = await supabase
    .from('organizers')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profile_id)

  const { data: participantRows } = await supabase
    .from('participants')
    .select('id')
    .eq('profile_id', profile_id)

  const participantIds = (participantRows ?? []).map(p => p.id)

  let games_played = 0
  let points_scored = 0

  if (participantIds.length > 0) {
    const { count } = await supabase
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .in('participant_id', participantIds)
      .eq('status', 'in')
    games_played = count ?? 0

    const { data: scoreRows } = await supabase
      .from('score_events')
      .select('points')
      .in('scored_by_player_id', participantIds)
      .eq('voided', false)
    points_scored = (scoreRows ?? []).reduce((sum, e) => sum + e.points, 0)
  }

  return NextResponse.json({
    ...profile,
    stats: {
      runs_organised: runs_organised ?? 0,
      games_played,
      points_scored,
    },
  })
}

export async function PATCH(req: NextRequest) {
  const profile_id = await getProfileFromRequest(req)
  if (!profile_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const allowed = ['display_name', 'avatar_url']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', profile_id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
