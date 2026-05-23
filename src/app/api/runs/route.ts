import { track } from '@/lib/analytics'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { buildShareText } from '@/lib/utils'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const { allowed } = await checkRateLimit(`create-run:${ip}`, 10, 60)
    if (!allowed) {
    return NextResponse.json(
  { error: 'Too many runs created. Try again later.' },
  { status: 429 }
)
    }

    const required = ['title', 'run_date', 'run_time', 'location_name', 'players_needed']
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 })
      }
    }

    const supabase = createServiceClient()

    const sessionTokenHash = req.headers.get('x-session-token-hash')
    let organizerId: string | null = null

    if (sessionTokenHash) {
      const { data: org } = await supabase
        .from('organizers')
        .select('id')
        .eq('session_token_hash', sessionTokenHash)
        .single()

      if (org) {
        organizerId = org.id
      } else {
        const { data: newOrg } = await supabase
          .from('organizers')
          .insert({ session_token_hash: sessionTokenHash })
          .select()
          .single()
        organizerId = newOrg?.id ?? null
      }
    }

    const { data: run, error } = await supabase
      .from('runs')
      .insert({
        title: body.title,
        run_date: body.run_date,
        run_time: body.run_time,
        location_name: body.location_name,
        players_needed: body.players_needed,
        notes: body.notes ?? null,
        organizer_id: organizerId,
      })
      .select()
      .single()

    if (error) {
      console.error('Create run error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ballzone.app'

    await track('run_created', { run_id: run.id, meta: { title: run.title } })
    return NextResponse.json({
      run_id: run.id,
      url: `${appUrl}/run/${run.id}`,
      share_token: run.share_token,
      share_text: buildShareText(run),
    }, { status: 201 })

  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
