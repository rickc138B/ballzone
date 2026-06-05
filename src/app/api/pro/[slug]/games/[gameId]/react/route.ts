import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

type Params = { params: Promise<{ slug: string; gameId: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { gameId } = await params
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('pro_game_reactions')
    .select('emoji, count')
    .eq('game_id', gameId)
  const result: Record<string, number> = {}
  for (const row of data ?? []) result[row.emoji] = row.count
  return NextResponse.json(result)
}

export async function POST(req: NextRequest, { params }: Params) {
  const { gameId } = await params
  const { emoji } = await req.json()
  if (!emoji) return NextResponse.json({ error: 'Emoji required' }, { status: 400 })
  const supabase = createServiceClient()
  const { data: existing } = await supabase
    .from('pro_game_reactions')
    .select('id, count')
    .eq('game_id', gameId)
    .eq('emoji', emoji)
    .single()
  if (existing) {
    await supabase.from('pro_game_reactions')
      .update({ count: existing.count + 1 })
      .eq('id', existing.id)
    return NextResponse.json({ count: existing.count + 1 })
  } else {
    await supabase.from('pro_game_reactions')
      .insert({ game_id: gameId, emoji, count: 1 })
    return NextResponse.json({ count: 1 })
  }
}
