import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { checkRateLimit } from '@/lib/rate-limit'
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
})

function generateOtp(): string {
  const digits = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(digits).map(b => b % 10).join('')
}

async function hashCode(code: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    const normalized = email.trim().toLowerCase()
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

    // Layer 1 — global ceiling: 50 OTPs per hour total
    const global = await checkRateLimit('otp:global', 50, 60)
    if (!global.allowed) {
      return NextResponse.json(
        { error: 'Service is busy, please try again later' },
        { status: 429 }
      )
    }

    // Layer 2 — per IP: 10 per hour
    const ipLimit = await checkRateLimit(`otp:ip:${ip}`, 10, 60)
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests from your network, try again later' },
        { status: 429 }
      )
    }

    // Layer 3 — per email: 3 per hour
    const emailLimit = await checkRateLimit(`otp:email:${normalized}`, 3, 60)
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many codes sent to this email, try again in an hour' },
        { status: 429 }
      )
    }

    const supabase = createServiceClient()
    const code = generateOtp()
    const code_hash = await hashCode(code)
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    await supabase.from('otp_codes').delete().eq('email', normalized)

    const { error: insertErr } = await supabase.from('otp_codes').insert({
      email: normalized,
      code_hash,
      expires_at,
      used: false,
    })

    if (insertErr) {
      console.error('otp insert error:', insertErr)
      return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 })
    }

    await transporter.sendMail({
      from: `"Ballzone" <${process.env.GMAIL_USER}>`,
      to: normalized,
      subject: `Your Ballzone code: ${code}`,
      html: `
        <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:32px;background:#0f1117;color:#fff;border-radius:12px">
          <h1 style="font-size:28px;font-weight:900;margin:0 0 8px">🏀 Ballzone</h1>
          <p style="color:#999;margin:0 0 32px">Your sign-in code</p>
          <div style="background:#1a1d2e;border-radius:8px;padding:24px;text-align:center;letter-spacing:0.5em;font-size:36px;font-weight:900;color:#f97316">
            ${code}
          </div>
          <p style="color:#666;font-size:13px;margin-top:24px">Expires in 10 minutes. If you didn't request this, ignore this email.</p>
        </div>
      `,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('OTP request error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
