import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

async function hashToken(token: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const EMOJI: Record<string, string> = {
  player: '🏀', team: '🏟', league: '🏆', user: '👤',
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('x-profile-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const token_hash = await hashToken(token)
  const { data: session } = await supabase
    .from('profile_sessions').select('profile_id').eq('token_hash', token_hash).single()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile_id = session.profile_id
  const type = new URL(req.url).searchParams.get('type')

  if (type === 'following') {
    const { data: rows } = await supabase
      .from('follows')
      .select('target_id, target_type, created_at')
      .eq('follower_id', profile_id)
      .order('created_at', { ascending: false })

    const items = await Promise.all((rows ?? []).map(async row => {
      let name = row.target_id
      let subtitle = row.target_type
      let href = '#'
      try {
        if (row.target_type === 'player') {
          const { data: p } = await supabase.from('pro_players').select('name').eq('id', row.target_id).maybeSingle()
          if (p) { name = p.name; href = `/pro/nba/player/${row.target_id}` }
          else {
            const { data: lp } = await supabase.from('league_players').select('display_name, league_teams(league_id)').eq('id', row.target_id).maybeSingle()
            if (lp) {
              name = lp.display_name
              const leagueId = (lp.league_teams as any)?.league_id
              href = leagueId ? `/league/${leagueId}/player/${row.target_id}` : '#'
            }
          }
          subtitle = 'Player'
        } else if (row.target_type === 'team') {
          const { data: t } = await supabase.from('pro_teams').select('name').eq('id', row.target_id).maybeSingle()
          if (t) { name = t.name; href = `/pro/nba/team/${row.target_id}` }
          subtitle = 'Team'
        } else if (row.target_type === 'league') {
          const { data: l } = await supabase.from('leagues').select('title').eq('id', row.target_id).maybeSingle()
          if (l) { name = l.title; href = `/league/${row.target_id}` }
          subtitle = 'League'
        }
      } catch {}
      return { id: row.target_id, name, subtitle, href, emoji: EMOJI[row.target_type] ?? '📌' }
    }))
    return NextResponse.json({ items })
  }

  if (type === 'followers') {
    const { data: rows } = await supabase
      .from('follows')
      .select('follower_id, created_at')
      .eq('target_id', profile_id)
      .eq('target_type', 'user')
      .order('created_at', { ascending: false })
    const items = await Promise.all((rows ?? []).map(async row => {
      const { data: p } = await supabase.from('profiles').select('display_name, email').eq('id', row.follower_id).maybeSingle()
      return {
        id: row.follower_id,
        name: p?.display_name ?? p?.email ?? 'Unknown',
        subtitle: 'User', href: '#', emoji: '👤',
      }
    }))
    return NextResponse.json({ items })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
