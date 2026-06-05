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
      const data = await res.json()
      return data.html ?? null
    }
    if (platform === 'instagram') {
      const res = await fetch(`https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&omit_script=true&access_token=`)
      // Instagram oEmbed requires token — fallback to link card
      return null
    }
    if (platform === 'youtube') {
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)
      const data = await res.json()
      return data.html ?? null
    }
    if (platform === 'tiktok') {
      const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`)
      const data = await res.json()
      return data.html ?? null
    }
  } catch (e) {
    return null
  }
  return null
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leagueId } = await params
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('league_clips')
      .select('*')
      .eq('league_id', leagueId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leagueId } = await params
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
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
