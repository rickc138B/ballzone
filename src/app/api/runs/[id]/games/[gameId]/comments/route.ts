import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  try {
    const { gameId } = await params
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('game_comments')
      .select('id, display_name, body, created_at')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('GET comments error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  try {
    const { gameId } = await params
    const { fingerprint, display_name, body } = await req.json()
    if (!fingerprint || !body?.trim()) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    if (body.length > 280) {
      return NextResponse.json({ error: 'Too long' }, { status: 400 })
    }
    const supabase = createServiceClient()

    const { count } = await supabase
      .from('game_comments')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', gameId)
      .eq('fingerprint', fingerprint)
    if ((count ?? 0) >= 5) {
      return NextResponse.json({ error: 'Rate limit reached' }, { status: 429 })
    }

    const { data, error } = await supabase
      .from('game_comments')
      .insert({ game_id: gameId, fingerprint, display_name: display_name?.trim() || null, body: body.trim() })
      .select('id, display_name, body, created_at')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('POST comment error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
