import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function hashCode(code: string): Promise<string> {
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(code)
  )
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json()
    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ error: 'phone required' }, { status: 400 })
    }

    const normalized = phone.replace(/\s+/g, '').replace(/^00/, '+')

    const code = generateOtp()
    const code_hash = await hashCode(code)
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min

    const supabase = createServiceClient()

    // Invalidate any existing unused codes for this phone
    await supabase
      .from('otp_codes')
      .update({ used: true })
      .eq('phone', normalized)
      .eq('used', false)

    await supabase.from('otp_codes').insert({
      phone: normalized,
      code_hash,
      expires_at,
    })

    // TODO: send SMS via Africa's Talking or Twilio
    // For now log to console in dev
    console.log(`OTP for ${normalized}: ${code}`)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('OTP request error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
