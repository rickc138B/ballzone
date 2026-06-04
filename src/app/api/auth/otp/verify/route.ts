import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

function generateToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hashToken(token: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function POST(req: NextRequest) {
  try {
    const { email, code, participant_id, organizer_token_hash } = await req.json()
    if (!email || !code) {
      return NextResponse.json({ error: 'email and code required' }, { status: 400 })
    }

    const normalized = email.trim().toLowerCase()
    const supabase = createServiceClient()
    const code_hash = await hashToken(code.trim())

    const { data: otpRow, error: otpErr } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('email', normalized)
      .eq('code_hash', code_hash)
      .eq('used', false)
      .single()

    if (otpErr || !otpRow) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 })
    }

    if (new Date(otpRow.expires_at) < new Date()) {
      await supabase.from('otp_codes').delete().eq('id', otpRow.id)
      return NextResponse.json({ error: 'Code expired' }, { status: 401 })
    }

    // mark used
    await supabase.from('otp_codes').update({ used: true }).eq('id', otpRow.id)

    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', normalized)
      .single()

    let is_new = false
    if (!profile) {
      const { data: newProfile, error: profileErr } = await supabase
        .from('profiles')
        .insert({ email: normalized })
        .select()
        .single()
      if (profileErr || !newProfile) {
        console.error('profile insert error:', profileErr)
        return NextResponse.json({ error: 'Could not create profile' }, { status: 500 })
      }
      profile = newProfile
      is_new = true
    }

    if (participant_id) {
      await supabase
        .from('league_players')
        .update({ profile_id: profile.id })
        .eq('id', participant_id)
        .is('profile_id', null)
    }

    if (organizer_token_hash) {
      await supabase
        .from('organizers')
        .update({ profile_id: profile.id })
        .eq('session_token_hash', organizer_token_hash)
        .is('profile_id', null)
    }

    const token = generateToken()
    const token_hash = await hashToken(token)

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
