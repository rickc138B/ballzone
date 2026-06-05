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
      const match = url.match(/instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/)
      if (match) {
        const shortcode = match[2]
        return `<iframe src="https://www.instagram.com/p/${shortcode}/embed/" width="100%" height="480" frameborder="0" scrolling="no" allowtransparency="true" allow="encrypted-media" style="border:none;overflow:hidden;background:#0f0f1a"></iframe>`
      }
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
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const supabase = createServiceClient()

    const { data: league } = await supabase
      .from('pro_leagues').select('id').eq('slug', slug).single()
    if (!league) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data, error } = await supabase
      .from('league_clips')
      .select('*')
      .eq('pro_league_id', league.id)
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
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { url, caption, added_by } = await req.json()
    if (!url?.trim()) return NextResponse.json({ error: 'URL required' }, { status: 400 })

    const supabase = createServiceClient()
    const { data: league } = await supabase
      .from('pro_leagues').select('id').eq('slug', slug).single()
    if (!league) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const platform = detectPlatform(url)
    const embedHtml = await fetchOEmbed(url, platform)

    const { data, error } = await supabase
      .from('league_clips')
      .insert({
        id: crypto.randomUUID(),
        pro_league_id: league.id,
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
