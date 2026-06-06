'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/',          emoji: '🏃',  label: 'Runs',     desc: 'Pickup games' },
  { href: '/leagues',   emoji: '🏆',  label: 'Leagues',  desc: 'Organised seasons' },
  { href: '/history',   emoji: '📋',  label: 'History',  desc: 'Past games' },
  { href: '/profile',   emoji: '👤',  label: 'Profile',  desc: 'Your account' },
  { href: '/pro/nba',    emoji: '🏀',  label: 'NBA',      desc: 'Pro stats' },
  { href: '/notifications', emoji: '🔔', label: 'Notifications', desc: 'Your alerts' },
]

export default function NavDrawer() {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const pathname = usePathname()

  const fetchUnread = useCallback(async () => {
    try {
      const token = localStorage.getItem('bz_profile_token')
      if (!token) return
      const res = await fetch('/api/notifications', {
        headers: { 'x-profile-token': token }
      })
      if (!res.ok) return
      const d = await res.json()
      setUnread(d.unread ?? 0)
    } catch {}
  }, [])

  useEffect(() => {
    fetchUnread()
    const interval = setInterval(fetchUnread, 60000)
    return () => clearInterval(interval)
  }, [fetchUnread])

  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="fixed top-4 left-4 z-40 w-10 h-10 flex flex-col items-center justify-center gap-1.5
                   rounded-xl bg-white/10 border border-white/10 backdrop-blur-sm active:scale-95 transition-transform"
      >
        <span className="w-4 h-0.5 bg-white rounded-full block" />
        <span className="w-4 h-0.5 bg-white rounded-full block" />
        <span className="w-2.5 h-0.5 bg-white/60 rounded-full block self-start ml-1" />
      </button>


      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}

      <div className={`fixed top-0 left-0 h-full w-72 z-50 flex flex-col
                       bg-[#0f0f1a] border-r border-white/10
                       transition-transform duration-300 ease-out
                       ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 pt-12 pb-6 border-b border-white/10">
          <div>
            <div className="text-white font-black text-xl tracking-tight">⛹️ Ballzone</div>
            <div className="text-white/30 text-xs mt-0.5">Your court. Your game.</div>
          </div>
          <button onClick={() => setOpen(false)}
            className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/40 text-sm">
            ✕
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(({ href, emoji, label, desc }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors
                  ${active ? 'bg-orange-500/15 border border-orange-500/30' : 'hover:bg-white/5 border border-transparent'}`}>
                <span className="text-xl w-8 text-center">{emoji}</span>
                <div>
                  <div className={`text-sm font-semibold ${active ? 'text-orange-400' : 'text-white'}`}>{label}</div>
                  <div className="text-white/30 text-xs">{desc}</div>
                </div>
                {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400" />}
              </Link>
            )
          })}
        </nav>

        <div className="px-5 py-6 border-t border-white/10">
          <div className="text-white/20 text-xs">Ballzone · Season 2026</div>
        </div>
      </div>
    </>
  )
}
