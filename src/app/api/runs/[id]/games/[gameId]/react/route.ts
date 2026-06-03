import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

const VALID_EMOJIS = ['🔥', '💀', '😤', '🏀']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  try {
    const { gameId } = await params
    const { fingerprint, emoji } = await req.json()

    if (!fingerprint || !VALID_EMOJIS.includes(emoji)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: existing } = await supabase
      .from('game_reactions')
      .select('id, emoji')
      .eq('game_id', gameId)
      .eq('fingerprint', fingerprint)
      .single()

    if (existing) {
      if (existing.emoji === emoji) {
        await supabase.from('game_reactions').delete().eq('id', existing.id)
        return NextResponse.json({ action: 'removed', emoji })
      } else {
        await supabase.from('game_reactions').update({ emoji }).eq('id', existing.id)
        return NextResponse.json({ action: 'switched', emoji })
      }
    }

    await supabase.from('game_reactions').insert({ game_id: gameId, fingerprint, emoji })
    return NextResponse.json({ action: 'added', emoji })
  } catch (err) {
    console.error('React error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  try {
    const { gameId } = await params
    const supabase = createServiceClient()

    const { data } = await supabase
      .from('game_reactions')
      .select('emoji, fingerprint')
      .eq('game_id', gameId)

    const counts: Record<string, number> = { '🔥': 0, '💀': 0, '😤': 0, '🏀': 0 }
    for (const r of data ?? []) {
      if (r.emoji in counts) counts[r.emoji]++
    }

    return NextResponse.json(counts)
  } catch (err) {
    console.error('Get reactions error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
