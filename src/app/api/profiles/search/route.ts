import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
 const q = req.nextUrl.searchParams.get('q')?.trim()
 if (!q || q.length < 2) return NextResponse.json([])

 const supabase = createServiceClient()
 const { data } = await supabase
   .from('profiles')
   .select('id, display_name, username, avatar_url')
   .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
   .limit(8)

 return NextResponse.json(data ?? [])
}
