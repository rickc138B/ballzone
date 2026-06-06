import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import bcrypt from 'bcryptjs'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; clipId: string }> }
) {
  try {
    const { id: leagueId, clipId } = await params
    const { pin } = await req.json()

    if (!pin?.trim()) return NextResponse.json({ error: 'PIN required' }, { status: 400 })

    const supabase = createServiceClient()
    const { data: league } = await supabase
      .from('leagues').select('admin_pin_hash').eq('id', leagueId).single()
    if (!league) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (league.admin_pin_hash) {
      const valid = await bcrypt.compare(pin.trim(), league.admin_pin_hash)
      if (!valid) return NextResponse.json({ error: 'Invalid PIN' }, { status: 403 })
    }

    const { error } = await supabase.from('league_clips').delete().eq('id', clipId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
