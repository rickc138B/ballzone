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
      .from('league_game_comments')
      .select('id, author_name, body, created_at')
      .eq('league_game_id', gameId)
      .order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  try {
    const { gameId } = await params
    const { author_name, body } = await req.json()
    if (!author_name?.trim() || !body?.trim())
      return NextResponse.json({ error: 'Name and body required' }, { status: 400 })
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('league_game_comments')
      .insert({ league_game_id: gameId, author_name: author_name.trim(), body: body.trim() })
      .select('id, author_name, body, created_at')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
