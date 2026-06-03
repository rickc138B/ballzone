import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import bcrypt from 'bcryptjs'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { pin } = await req.json()
    if (!pin?.trim()) return NextResponse.json({ valid: false }, { status: 400 })

    const supabase = createServiceClient()
    const { data: league, error } = await supabase
      .from('leagues')
      .select('admin_pin_hash')
      .eq('id', id)
      .single()

    if (error || !league) return NextResponse.json({ valid: false }, { status: 404 })
    if (!league.admin_pin_hash) return NextResponse.json({ valid: true }) // no PIN set, open

    const valid = await bcrypt.compare(pin.trim(), league.admin_pin_hash)
    return NextResponse.json({ valid })
  } catch {
    return NextResponse.json({ valid: false }, { status: 500 })
  }
}
