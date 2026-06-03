'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewLeaguePage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [season, setSeason] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [adminPin, setAdminPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    if (!title.trim()) return
    setSaving(true)
    const res = await fetch('/api/leagues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, season, location_name: location, description, admin_pin: adminPin }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setSaving(false); return }
    router.push(`/league/${data.id}`)
  }

  return (
    <main className="min-h-dvh flex flex-col p-5 max-w-lg mx-auto">
      <div className="pt-4 mb-8">
        <div className="text-3xl mb-2">🏆</div>
        <h1 className="text-2xl font-black text-white">New League</h1>
        <p className="text-white/40 text-sm mt-1">Create a league to track games and standings</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">League Name *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="OTB Hoop Rush"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3
                       text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500"
          />
        </div>
        <div>
          <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">Season</label>
          <input
            value={season}
            onChange={e => setSeason(e.target.value)}
            placeholder="2026"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3
                       text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500"
          />
        </div>
        <div>
          <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">Location</label>
          <input
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="FUTO Owerri"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3
                       text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500"
          />
        </div>
        <div>
          <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">Admin PIN *</label>
          <input
            type="password"
            value={adminPin}
            onChange={e => setAdminPin(e.target.value)}
            placeholder="Min 4 characters"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3
                       text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500"
          />
          <p className="text-white/20 text-xs mt-1">Keep this safe — needed to add games and access admin</p>
        </div>
        <div>
          <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="About this league..."
            rows={3}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3
                       text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500
                       resize-none"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={create}
          disabled={!title.trim() || !adminPin.trim() || adminPin.length < 4 || saving}
          className="w-full py-4 rounded-2xl font-bold text-lg bg-orange-500 text-white
                     active:scale-95 transition-transform disabled:opacity-50 mt-2"
        >
          {saving ? 'Creating...' : 'Create League →'}
        </button>
      </div>
    </main>
  )
}
