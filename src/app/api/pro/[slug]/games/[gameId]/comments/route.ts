import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

type Params = { params: Promise<{ slug: string; gameId: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { gameId } = await params
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('pro_game_comments')
    .select('*')
    .eq('game_id', gameId)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json([], { status: 200 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: Params) {
  const { gameId } = await params
  const { author_name, body } = await req.json()
  if (!body?.trim()) return NextResponse.json({ error: 'Body required' }, { status: 400 })
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('pro_game_comments')
    .insert({ game_id: gameId, author_name: author_name || 'Anonymous', body: body.trim() })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
