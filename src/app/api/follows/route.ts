import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

async function hashToken(token: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function getProfileFromRequest(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('x-profile-token')
  if (!token) return null
  const supabase = createServiceClient()
  const token_hash = await hashToken(token)
  const { data } = await supabase
    .from('profile_sessions')
    .select('profile_id')
    .eq('token_hash', token_hash)
    .single()
  return data?.profile_id ?? null
}

// GET /api/follows?target_id=xxx&target_type=team
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const target_id = searchParams.get('target_id')
  const target_type = searchParams.get('target_type')
  if (!target_id || !target_type) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const supabase = createServiceClient()
  const { count } = await supabase
    .from('follows')
    .select('id', { count: 'exact', head: true })
    .eq('target_id', target_id)
    .eq('target_type', target_type)

  const profile_id = await getProfileFromRequest(req)
  let following = false
  if (profile_id) {
    const { data } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', profile_id)
      .eq('target_id', target_id)
      .eq('target_type', target_type)
      .single()
    following = !!data
  }

  return NextResponse.json({ count: count ?? 0, following })
}

// POST /api/follows  { target_id, target_type }  — toggles
export async function POST(req: NextRequest) {
  const profile_id = await getProfileFromRequest(req)
  if (!profile_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { target_id, target_type } = await req.json()
  if (!target_id || !target_type) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: existing } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', profile_id)
    .eq('target_id', target_id)
    .eq('target_type', target_type)
    .single()

  if (existing) {
    await supabase.from('follows').delete().eq('id', existing.id)
    return NextResponse.json({ following: false })
  } else {
    await supabase.from('follows').insert({ follower_id: profile_id, target_id, target_type })
    return NextResponse.json({ following: true })
  }
}
