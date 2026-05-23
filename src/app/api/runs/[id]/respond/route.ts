import { track } from '@/lib/analytics'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: runId } = await params
    const body = await req.json()
    const { status, display_name, fingerprint, participant_id } = body

    if (!['in', 'out', 'late'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Rate limit: max 10 response changes per fingerprint per hour
    const { allowed } = await checkRateLimit(`respond:${fingerprint ?? 'unknown'}`, 10, 60)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }

    if (!fingerprint) {
      return NextResponse.json({ error: 'fingerprint required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: run } = await supabase
      .from('runs')
      .select('status, players_needed')
      .eq('id', runId)
      .single()

    if (!run || run.status === 'cancelled') {
      return NextResponse.json({ error: 'Run not available' }, { status: 404 })
    }

    // Find or create participant
    let pid = participant_id

    if (pid) {
      // Update name if provided
      if (display_name) {
        await supabase
          .from('participants')
          .update({ display_name })
          .eq('id', pid)
      }
    } else {
      // Try to find by fingerprint
      const { data: existing } = await supabase
        .from('participants')
        .select('id')
        .eq('fingerprint', fingerprint)
        .single()

      if (existing) {
        pid = existing.id
        if (display_name) {
          await supabase
            .from('participants')
            .update({ display_name })
            .eq('id', pid)
        }
      } else {
        // Create new participant
        const { data: newP } = await supabase
          .from('participants')
          .insert({ fingerprint, display_name: display_name ?? null })
          .select()
          .single()
        pid = newP?.id
      }
    }

    if (!pid) {
      return NextResponse.json({ error: 'Could not identify participant' }, { status: 500 })
    }

    // Upsert attendance
    const { error: attError } = await supabase
      .from('attendance')
      .upsert({
        run_id: runId,
        participant_id: pid,
        status,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'run_id,participant_id' })

    if (attError) {
      console.error('Attendance upsert error:', attError)
      return NextResponse.json({ error: attError.message }, { status: 500 })
    }

    await track('attendance_responded', { run_id: runId, meta: { status } })
    return NextResponse.json({ participant_id: pid, status }, { status: 200 })

  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
