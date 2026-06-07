'use client'

import { useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function RunCreatedPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const runId = params.id as string
  const shareText = searchParams.get('share_text') ?? ''
  const token = searchParams.get('token') ?? ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const runUrl = `${appUrl}/run/${runId}${token ? `?token=${token}` : ''}`
  const runPageHref = `/run/${runId}${token ? `?token=${token}` : ''}`

  const [copied, setCopied] = useState(false)

  async function copyLink() {
    await navigator.clipboard.writeText(runUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function shareToWhatsApp() {
    const encoded = encodeURIComponent(shareText)
    window.open(`https://wa.me/?text=${encoded}`, '_blank')
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 max-w-lg mx-auto">
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">✅</div>
        <h1 className="text-2xl font-black text-white mb-1">Run Created!</h1>
        <p className="text-white/50 text-sm">Share the link with your group</p>
      </div>

      <div className="w-full card p-4 mb-4">
        <p className="text-white/50 text-xs mb-1">Your run link</p>
        <p className="text-orange-400 font-mono text-sm break-all">{runUrl}</p>
      </div>

      <div className="w-full space-y-3 mb-6">
        <button onClick={copyLink} className="btn-primary">
          {copied ? '✓ Copied!' : 'Copy Link'}
        </button>
        <button onClick={shareToWhatsApp} className="btn-secondary">
          Share to WhatsApp 📲
        </button>
      </div>

      <div className="w-full card p-4 mb-6">
        <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Preview</p>
        <p className="text-white/80 text-sm whitespace-pre-line font-mono leading-relaxed">
          {shareText}
        </p>
      </div>

      <Link href={runPageHref} className="text-white/40 text-sm underline underline-offset-2">
        View run page →
      </Link>
    </main>
  )
}
