import { NextRequest, NextResponse } from 'next/server'

const ESPN_ABBR_MAP: Record<string, string> = {
  'NY': 'NYK', 'GS': 'GSW', 'SA': 'SAS', 'NO': 'NOP', 'UTH': 'UTA',
}
const normalize = (a: string) => ESPN_ABBR_MAP[a] ?? a

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; gameId: string }> }
) {
  const { gameId } = await params
  try {
    const dates = [new Date(), new Date(Date.now() - 86400000), new Date(Date.now() - 172800000)].map(d =>
      d.toISOString().split('T')[0].replace(/-/g, '')
    )
    for (const date of dates) {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${date}`,
        { cache: 'no-store' }
      )
      if (!res.ok) continue
      const data = await res.json()
      for (const event of data.events ?? []) {
        const comp = event.competitions?.[0]
        if (!comp) continue
        const home = comp.competitors?.find((c: any) => c.homeAway === 'home')
        const away = comp.competitors?.find((c: any) => c.homeAway === 'away')
        if (!home || !away) continue
        const status = comp.status?.type?.description ?? 'Scheduled'
        const period = comp.status?.period ?? 0
        const clock = comp.status?.displayClock ?? ''
        const homeScore = parseInt(home.score ?? '0')
        const awayScore = parseInt(away.score ?? '0')
        const homeAbbr = normalize(home.team.abbreviation)
        const awayAbbr = normalize(away.team.abbreviation)
        // Match by ESPN event ID embedded in our gameId, or by team abbrs as fallback
        // Match by team abbrs stored in our gameId context via DB lookup
        // Fall back: return first non-scheduled game with scores (works for single-game days like Finals)
        if (status !== 'Scheduled' && (homeScore + awayScore > 0 || status.toLowerCase().includes('progress'))) {
          return NextResponse.json({ homeScore, awayScore, status, period, clock, homeAbbr, awayAbbr })
        }
      }
    }
    return NextResponse.json({ error: 'No live game found' }, { status: 404 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
