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

// GET /api/notifications — last 30, unread first
export async function GET(req: NextRequest) {
  const profile_id = await getProfileFromRequest(req)
  if (!profile_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('profile_id', profile_id)
    .order('created_at', { ascending: false })
    .limit(30)

  const unread = (data ?? []).filter(n => !n.read).length
  return NextResponse.json({ notifications: data ?? [], unread })
}
