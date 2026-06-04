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

    if (!league.admin_pin_hash) {
      if (pin.trim().length < 4) {
        return NextResponse.json(
          { valid: false, reason: 'too_short', message: 'PIN must be at least 4 characters' },
          { status: 400 }
        )
      }
      const hash = await bcrypt.hash(pin.trim(), 10)
      await supabase.from('leagues').update({ admin_pin_hash: hash }).eq('id', id)
      return NextResponse.json({ valid: true, pin_set: true })
    }

    const valid = await bcrypt.compare(pin.trim(), league.admin_pin_hash)
    return NextResponse.json({ valid })
  } catch {
    return NextResponse.json({ valid: false }, { status: 500 })
  }
}
