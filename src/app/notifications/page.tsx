'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Notification = {
  id: string
  type: string
  title: string
  body: string | null
  data: Record<string, string> | null
  read: boolean
  created_at: string
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('bz_profile_token')
    if (!token) { setLoading(false); return }
    setAuthed(true)
    fetch('/api/notifications', { headers: { 'x-profile-token': token } })
      .then(r => r.json())
      .then(d => { setNotifs(d.notifications ?? []); setLoading(false) })
    // mark all read
    fetch('/api/notifications/read', {
      method: 'PATCH',
      headers: { 'x-profile-token': token }
    })
  }, [])

  function getLink(n: Notification) {
    if (n.data?.gameId) return `/pro/nba/game/${n.data.gameId}`
    return null
  }

  return (
    <main className="min-h-dvh flex flex-col p-5 max-w-lg mx-auto pb-10">
      <div className="pt-12 mb-6">
        <p className="text-orange-400 text-xs uppercase tracking-wider font-semibold mb-1">🔔 Alerts</p>
        <h1 className="text-2xl font-black text-white leading-tight">Notifications</h1>
      </div>

      {loading ? (
        <div className="text-white/40 py-20 text-center">Loading...</div>
      ) : !authed ? (
        <div className="flex flex-col items-center py-20 text-center gap-4">
          <div className="text-4xl">🔔</div>
          <p className="text-white font-bold">Sign in to get notifications</p>
          <Link href="/profile" className="px-5 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold">
            Go to Profile
          </Link>
        </div>
      ) : notifs.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center gap-3">
          <div className="text-4xl">🔔</div>
          <p className="text-white font-bold">No notifications yet</p>
          <p className="text-white/40 text-sm">Follow teams to get game updates</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifs.map(n => {
            const link = getLink(n)
            const inner = (
              <div className={`card p-4 border-white/10 flex gap-3 items-start transition-colors
                ${!n.read ? 'border-orange-500/30 bg-orange-500/5' : ''}`}>
                <div className="text-xl mt-0.5">
                  {n.type === 'game_final' ? '🏁' : n.type === 'game_update' ? '🔴' : '🔔'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold leading-snug">{n.title}</p>
                  {n.body && <p className="text-white/40 text-xs mt-0.5">{n.body}</p>}
                </div>
                <span className="text-white/20 text-xs flex-shrink-0">{timeAgo(n.created_at)}</span>
              </div>
            )
            return link
              ? <Link key={n.id} href={link}>{inner}</Link>
              : <div key={n.id}>{inner}</div>
          })}
        </div>
      )}
    </main>
  )
}
