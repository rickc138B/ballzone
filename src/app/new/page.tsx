'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  getOrCreateSessionToken,
  hashToken,
  saveOrganizerRun,
  getLastRun,
} from '@/lib/session-token'
import type { CreateRunResponse } from '@/lib/types'

function getNextSaturday(): string {
  const d = new Date()
  const day = d.getDay()
  const daysUntilSat = (6 - day + 7) % 7 || 7
  d.setDate(d.getDate() + daysUntilSat)
  return d.toISOString().split('T')[0]
}

export default function NewRunPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showNotes, setShowNotes] = useState(false)

  const [form, setForm] = useState({
    title: '',
    run_date: getNextSaturday(),
    run_time: '09:00',
    location_name: '',
    players_needed: 10,
    notes: '',
  })

  useEffect(() => {
    const last = getLastRun()
    if (last) {
      setForm(f => ({
        ...f,
        title: last.title,
        location_name: last.location_name,
        run_time: last.run_time,
      }))
    }
  }, [])

  function set(field: string, value: string | number) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit() {
    if (!form.title || !form.location_name) {
      setError('Title and location are required')
      return
    }
    setLoading(true)
    setError('')

    try {
      const token = getOrCreateSessionToken()
      const tokenHash = await hashToken(token)

      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token-hash': tokenHash,
        },
        body: JSON.stringify(form),
      })

      const data: CreateRunResponse = await res.json()

      if (!res.ok) {
        setError((data as any).error ?? 'Something went wrong')
        return
      }

      saveOrganizerRun({
        run_id: data.run_id,
        share_token: data.share_token,
        title: form.title,
        location_name: form.location_name,
        run_time: form.run_time,
        run_date: form.run_date,
        created_at: new Date().toISOString(),
      })

      router.push(`/run/${data.run_id}/created?share_text=${encodeURIComponent(data.share_text)}`)
    } catch (e) {
      setError('Network error — check your connection')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-dvh flex flex-col p-6 max-w-lg mx-auto">
      <div className="mb-8 pt-4">
        <div className="flex items-center justify-between mb-1">
          <div className="text-3xl">🏀</div>
          <a href="/history" className="text-white/30 text-sm underline underline-offset-2">
            Your runs
          </a>
        </div>
        <h1 className="text-2xl font-black text-white">New Run</h1>
        <p className="text-white/50 text-sm">Fill in the details below</p>
      </div>

      <div className="space-y-4 flex-1">
        {/* Title */}
        <div>
          <label className="text-white/60 text-xs uppercase tracking-wider mb-1 block">
            Title
          </label>
          <input
            type="text"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="Lekki Saturday"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 
                       text-white placeholder:text-white/30 focus:outline-none 
                       focus:border-orange-500 text-base"
          />
        </div>

        {/* Date */}
        <div>
          <label className="text-white/60 text-xs uppercase tracking-wider mb-1 block">
            Date
          </label>
          <input
            type="date"
            value={form.run_date}
            onChange={e => set('run_date', e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 
                       text-white focus:outline-none focus:border-orange-500 text-base
                       [color-scheme:dark]"
          />
        </div>

        {/* Time */}
        <div>
          <label className="text-white/60 text-xs uppercase tracking-wider mb-1 block">
            Time
          </label>
          <input
            type="time"
            value={form.run_time}
            onChange={e => set('run_time', e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 
                       text-white focus:outline-none focus:border-orange-500 text-base
                       [color-scheme:dark]"
          />
        </div>

        {/* Location */}
        <div>
          <label className="text-white/60 text-xs uppercase tracking-wider mb-1 block">
            Court / Location
          </label>
          <input
            type="text"
            value={form.location_name}
            onChange={e => set('location_name', e.target.value)}
            placeholder="Lekki Courts, Victoria Island"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 
                       text-white placeholder:text-white/30 focus:outline-none 
                       focus:border-orange-500 text-base"
          />
        </div>

        {/* Players Needed */}
        <div>
          <label className="text-white/60 text-xs uppercase tracking-wider mb-1 block">
            Players Needed
          </label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => set('players_needed', Math.max(2, form.players_needed - 1))}
              className="w-12 h-12 rounded-full bg-white/10 border border-white/20 
                         text-white text-xl font-bold active:scale-95 transition-transform"
            >
              −
            </button>
            <span className="text-3xl font-black text-white flex-1 text-center">
              {form.players_needed}
            </span>
            <button
              onClick={() => set('players_needed', Math.min(30, form.players_needed + 1))}
              className="w-12 h-12 rounded-full bg-white/10 border border-white/20 
                         text-white text-xl font-bold active:scale-95 transition-transform"
            >
              +
            </button>
          </div>
        </div>

        {/* Notes (collapsed by default) */}
        {!showNotes ? (
          <button
            onClick={() => setShowNotes(true)}
            className="text-white/40 text-sm underline underline-offset-2"
          >
            + Add notes (optional)
          </button>
        ) : (
          <div>
            <label className="text-white/60 text-xs uppercase tracking-wider mb-1 block">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Bring your own water"
              rows={2}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 
                         text-white placeholder:text-white/30 focus:outline-none 
                         focus:border-orange-500 text-base resize-none"
            />
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}
      </div>

      <div className="pt-6 pb-2">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? 'Creating...' : 'Create Run →'}
        </button>
      </div>
    </main>
  )
}
