import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

function detectPlatform(url: string): string {
  if (url.includes('tiktok.com')) return 'tiktok'
  if (url.includes('instagram.com')) return 'instagram'
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  return 'other'
}

async function fetchOEmbed(url: string, platform: string): Promise<string | null> {
  try {
    if (platform === 'twitter') {
      const res = await fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`)
      return (await res.json()).html ?? null
    }
    if (platform === 'instagram') {
      const match = url.match(/instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/)
      if (match) return `<iframe src="https://www.instagram.com/p/${match[2]}/embed/" width="100%" height="480" frameborder="0" scrolling="no" allowtransparency="true" allow="encrypted-media" style="border:none;overflow:hidden;background:#0f0f1a"></iframe>`
      return null
    }
    if (platform === 'youtube') {
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)
      return (await res.json()).html ?? null
    }
    if (platform === 'tiktok') {
      const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`)
      return (await res.json()).html ?? null
    }
  } catch { return null }
  return null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  try {
    const { gameId } = await params
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('league_clips')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  try {
    const { id: leagueId, gameId } = await params
    const { url, caption, added_by } = await req.json()
    if (!url?.trim()) return NextResponse.json({ error: 'URL required' }, { status: 400 })

    const platform = detectPlatform(url)
    const embedHtml = await fetchOEmbed(url, platform)

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('league_clips')
      .insert({
        id: crypto.randomUUID(),
        league_id: leagueId,
        game_id: gameId,
        url: url.trim(),
        platform,
        embed_html: embedHtml,
        caption: caption?.trim() ?? null,
        added_by: added_by?.trim() ?? 'Anonymous',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
