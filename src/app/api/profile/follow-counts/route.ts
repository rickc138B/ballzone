import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

async function hashToken(token: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('x-profile-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const token_hash = await hashToken(token)
  const { data: session } = await supabase
    .from('profile_sessions')
    .select('profile_id')
    .eq('token_hash', token_hash)
    .single()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile_id = session.profile_id

  const [{ count: following }, { count: followers }] = await Promise.all([
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', profile_id),
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('target_id', profile_id).eq('target_type', 'user'),
  ])

  return NextResponse.json({ following: following ?? 0, followers: followers ?? 0 })
}
