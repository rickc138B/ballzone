import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; playerId: string }> }
) {
  try {
    const { playerId } = await params
    const { claim_code, fingerprint } = await req.json()
    if (!claim_code?.trim() || !fingerprint?.trim())
      return NextResponse.json({ error: 'Code and fingerprint required' }, { status: 400 })

    const supabase = createServiceClient()

    const { data: player, error } = await supabase
      .from('league_players')
      .select('id, claim_code, claimed_by')
      .eq('id', playerId)
      .single()

    if (error || !player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

    if (player.claimed_by) {
      if (player.claimed_by === fingerprint)
        return NextResponse.json({ success: true, already_claimed: true })
      return NextResponse.json({ error: 'Already claimed by someone else' }, { status: 409 })
    }

    if (player.claim_code !== claim_code.trim().toUpperCase())
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 })

    const { error: updateError } = await supabase
      .from('league_players')
      .update({ claimed_by: fingerprint, claimed_at: new Date().toISOString() })
      .eq('id', playerId)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Claim error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
