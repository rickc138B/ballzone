import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

type Params = { params: Promise<{ slug: string; gameId: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { gameId } = await params
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('pro_game_clips')
    .select('*')
    .eq('game_id', gameId)
    .order('created_at', { ascending: false })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: Params) {
  const { gameId } = await params
  const { url, caption, added_by, platform } = await req.json()
  if (!url?.trim()) return NextResponse.json({ error: 'URL required' }, { status: 400 })
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('pro_game_clips')
    .insert({ game_id: gameId, url: url.trim(), caption, added_by: added_by || 'Anonymous', platform: platform || 'other' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
