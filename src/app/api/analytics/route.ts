import { NextRequest, NextResponse } from 'next/server'
import { track, AnalyticsEvent } from '@/lib/analytics'

export async function POST(req: NextRequest) {
  try {
    const { event, run_id, meta } = await req.json()
    if (!event) return NextResponse.json({ error: 'Missing event' }, { status: 400 })
    await track(event as AnalyticsEvent, { run_id, meta })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
