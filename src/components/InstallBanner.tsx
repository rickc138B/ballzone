'use client'

import { useEffect, useState } from 'react'

export default function InstallBanner() {
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem('bz_install_dismissed')
    if (dismissed) return

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true

    if (ios && !standalone) {
      setIsIOS(true)
      setShow(true)
    }

    // Android/Chrome — listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      ;(window as any).__installPrompt = e
      if (!standalone) setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    localStorage.setItem('bz_install_dismissed', '1')
    setShow(false)
  }

  async function install() {
    const prompt = (window as any).__installPrompt
    if (prompt) {
      prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome === 'accepted') dismiss()
    }
  }

  if (!show) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 max-w-lg mx-auto">
      <div className="bg-[#1a1d2e] border border-white/10 rounded-2xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <img src="/icon-192.png" alt="Ballzone" className="w-12 h-12 rounded-xl flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm">Add Ballzone to Home Screen</p>
            {isIOS ? (
              <p className="text-white/40 text-xs mt-1 leading-relaxed">
                Tap <span className="text-white/70">Share</span> <span className="text-base">⎋</span> then{' '}
                <span className="text-white/70">"Add to Home Screen"</span>
              </p>
            ) : (
              <p className="text-white/40 text-xs mt-1">Install for the full app experience</p>
            )}
          </div>
          <button onClick={dismiss} className="text-white/20 text-lg leading-none flex-shrink-0">✕</button>
        </div>
        {!isIOS && (
          <button
            onClick={install}
            className="mt-3 w-full py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold active:scale-95 transition-transform"
          >
            Install App
          </button>
        )}
      </div>
    </div>
  )
}
