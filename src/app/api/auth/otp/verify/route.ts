import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

async function hashCode(code: string): Promise<string> {
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(code)
  )
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function generateToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function POST(req: NextRequest) {
  try {
    const { phone, code, participant_id, organizer_token_hash } = await req.json()

    if (!phone || !code) {
      return NextResponse.json({ error: 'phone and code required' }, { status: 400 })
    }

    const normalized = phone.replace(/\s+/g, '').replace(/^00/, '+')
    const code_hash = await hashCode(code)
    const supabase = createServiceClient()

    // Find valid OTP
    const { data: otp } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('phone', normalized)
      .eq('code_hash', code_hash)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!otp) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 })
    }

    // Mark used
    await supabase.from('otp_codes').update({ used: true }).eq('id', otp.id)

    // Find or create profile
    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', normalized)
      .single()

    let is_new = false
    if (!profile) {
      const { data: newProfile } = await supabase
        .from('profiles')
        .insert({ phone: normalized })
        .select()
        .single()
      profile = newProfile
      is_new = true
    }

    if (!profile) {
      return NextResponse.json({ error: 'Could not create profile' }, { status: 500 })
    }

    // Link participant if provided
    if (participant_id) {
      await supabase
        .from('participants')
        .update({ profile_id: profile.id })
        .eq('id', participant_id)
        .is('profile_id', null) // don't overwrite existing links
    }

    // Link organizer if provided
    if (organizer_token_hash) {
      await supabase
        .from('organizers')
        .update({ profile_id: profile.id })
        .eq('session_token_hash', organizer_token_hash)
        .is('profile_id', null)
    }

    // Create session token
    const token = generateToken()
    const token_hash = await hashCode(token)

    await supabase.from('profile_sessions').insert({
      profile_id: profile.id,
      token_hash,
    })

    return NextResponse.json({
      profile_id: profile.id,
      profile_token: token,
      display_name: profile.display_name,
      is_new,
    })
  } catch (err) {
    console.error('OTP verify error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
