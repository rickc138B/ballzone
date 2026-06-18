import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const { title, description, season, location_name, admin_pin, fingerprint, is_public } = await req.json()
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
        is_public: is_public === true,
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

export async function GET(req: NextRequest) {
  try {
    const fingerprint = req.nextUrl.searchParams.get('fingerprint')
    const supabase = createServiceClient()

    const { data: publicLeagues, error: e1 } = await supabase
      .from('leagues')
      .select('id, title, season, location_name, created_at, is_public')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

    let privateLeagues: any[] = []
    if (fingerprint) {
      const { data: mine } = await supabase
        .from('leagues')
        .select('id, title, season, location_name, created_at, is_public')
        .eq('is_public', false)
        .eq('created_by', fingerprint)
        .order('created_at', { ascending: false })
      privateLeagues = (mine ?? []).filter(l => !(publicLeagues ?? []).find((p: any) => p.id === l.id))
    }

    return NextResponse.json({ public: publicLeagues ?? [], private: privateLeagues })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
