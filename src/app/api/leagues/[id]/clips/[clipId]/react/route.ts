import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; clipId: string }> }
) {
  try {
    const { clipId } = await params
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('league_clip_reactions')
      .select('emoji, author_name')
      .eq('clip_id', clipId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const counts: Record<string, number> = {}
    for (const r of data ?? []) counts[r.emoji] = (counts[r.emoji] ?? 0) + 1
    return NextResponse.json(counts)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; clipId: string }> }
) {
  try {
    const { clipId } = await params
    const { emoji, author_name } = await req.json()
    if (!emoji || !author_name?.trim())
      return NextResponse.json({ error: 'Emoji and name required' }, { status: 400 })
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('league_clip_reactions')
      .insert({ clip_id: clipId, emoji, author_name: author_name.trim() })
      .select('id, emoji, author_name')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
