import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = createServiceClient()

    const { data: leagues, error } = await supabase
      .from('pro_leagues')
      .select('id, name, slug, region')
      .order('name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: currentSeasons } = await supabase
      .from('pro_seasons')
      .select('league_id, slug, label')
      .eq('is_current', true)

    const seasonByLeague: Record<string, { slug: string; label: string }> = {}
    for (const s of currentSeasons ?? []) {
      seasonByLeague[s.league_id] = { slug: s.slug, label: s.label }
    }

    const result = (leagues ?? []).map(l => ({
      ...l,
      current_season: seasonByLeague[l.id] ?? null,
    }))

    return NextResponse.json({ leagues: result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
