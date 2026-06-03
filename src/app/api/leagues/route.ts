import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const { title, description, season, location_name, admin_pin, fingerprint } = await req.json()
    if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })
    if (!admin_pin?.trim()) return NextResponse.json({ error: 'Admin PIN required' }, { status: 400 })
    if (admin_pin.length < 4) return NextResponse.json({ error: 'PIN must be at least 4 characters' }, { status: 400 })

    const admin_pin_hash = await bcrypt.hash(admin_pin.trim(), 10)
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('leagues')
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        season: season?.trim() || null,
        location_name: location_name?.trim() || null,
        admin_pin_hash,
        created_by: fingerprint ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('POST league error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('leagues')
      .select('id, title, season, location_name, created_at')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
