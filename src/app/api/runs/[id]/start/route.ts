import { track } from '@/lib/analytics'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: runId } = await params
    const shareToken = req.headers.get('x-share-token')

    if (!shareToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    const { data: run } = await supabase
      .from('runs')
      .select('*')
      .eq('id', runId)
      .eq('share_token', shareToken)
      .single()

    if (!run) {
      return NextResponse.json({ error: 'Unauthorized or run not found' }, { status: 401 })
    }

    if (run.status !== 'open') {
      return NextResponse.json({ error: `Run is ${run.status}` }, { status: 400 })
    }

    await supabase
      .from('runs')
      .update({ status: 'active' })
      .eq('id', runId)

    const sessionId = runId
    await supabase
      .from('sessions')
      .upsert({
        id: sessionId,
        run_id: runId,
        status: 'lobby',
      })

    await track('game_started', { run_id: runId })
    return NextResponse.json({ session_id: sessionId, status: 'active' })

  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
