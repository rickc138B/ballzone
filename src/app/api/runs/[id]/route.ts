import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()

    const { data: run, error } = await supabase
      .from('runs')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    const { data: attendance } = await supabase
      .from('attendance')
      .select('*, participant:participants(*)')
      .eq('run_id', id)
      .order('responded_at', { ascending: true })

    const counts = {
      in: 0,
      out: 0,
      late: 0,
    }

    for (const a of attendance ?? []) {
      if (a.status === 'in') counts.in++
      else if (a.status === 'out') counts.out++
      else if (a.status === 'late') counts.late++
    }

    const shareToken = req.headers.get('x-share-token')
    const isOrganizer = !!shareToken && shareToken === run.share_token

    return NextResponse.json({
      ...run,
      share_token: undefined, // never expose to client
      isOrganizer,
      attendance: attendance ?? [],
      counts,
    })

  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const shareToken = req.headers.get('x-share-token')
    if (!shareToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Verify share token
    const { data: run, error } = await supabase
      .from('runs')
      .select('id, share_token, status')
      .eq('id', id)
      .single()

    if (error || !run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }
    if (run.share_token !== shareToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (run.status !== 'open') {
      return NextResponse.json({ error: 'Can only edit open runs' }, { status: 400 })
    }

    const allowed = ['title', 'run_date', 'run_time', 'location_name', 'notes', 'players_needed']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    const { data: updated, error: updateError } = await supabase
      .from('runs')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('PATCH run error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}