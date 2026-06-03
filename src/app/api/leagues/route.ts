import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const { title, description, season, location_name } = await req.json()
    if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('leagues')
      .insert({ title: title.trim(), description: description?.trim() || null, season: season?.trim() || null, location_name: location_name?.trim() || null })
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
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
