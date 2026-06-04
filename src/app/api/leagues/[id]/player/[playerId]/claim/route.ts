import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; playerId: string }> }
) {
  try {
    const { playerId } = await params
    const { claim_code } = await req.json()

    if (!claim_code?.trim())
      return NextResponse.json({ error: 'Code required' }, { status: 400 })

    const supabase = createServiceClient()

    const { data: player, error } = await supabase
      .from('league_players')
      .select('id, claim_code, profile_id, claimed_by')
      .eq('id', playerId)
      .single()

    if (error || !player)
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })

    // Already claimed by a real profile
    if (player.profile_id)
      return NextResponse.json({ error: 'Already claimed' }, { status: 409 })

    if (player.claim_code !== claim_code.trim().toUpperCase())
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 })

    // Code is valid — tell the client to now sign in with email
    // The OTP verify route will link profile_id via participant_id
    return NextResponse.json({ valid: true, participant_id: playerId })
  } catch (err) {
    console.error('Claim error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
