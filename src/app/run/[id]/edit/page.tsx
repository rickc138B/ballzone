'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { isOrganizerOfRun, getShareToken } from '@/lib/session-token'
import { formatRunTime } from '@/lib/utils'
import type { Run } from '@/lib/types'

export default function EditRunPage() {
  const params = useParams()
  const router = useRouter()
  const runId = params.id as string

  const [run, setRun] = useState<Run | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)

  const [title, setTitle] = useState('')
  const [runDate, setRunDate] = useState('')
  const [runTime, setRunTime] = useState('')
  const [locationName, setLocationName] = useState('')
  const [notes, setNotes] = useState('')
  const [playersNeeded, setPlayersNeeded] = useState(10)

  const fetchRun = useCallback(async () => {
    const res = await fetch(`/api/runs/${runId}`)
    if (!res.ok) { setLoading(false); setNotAllowed(true); return }
    const data: Run = await res.json()

    if (data.status !== 'open') { setNotAllowed(true); setLoading(false); return }

    setRun(data)
    setTitle(data.title)
    setRunDate(data.run_date)
    setRunTime(data.run_time)
    setLocationName(data.location_name)
    setNotes(data.notes ?? '')
    setPlayersNeeded(data.players_needed)
    setLoading(false)
  }, [runId])

  useEffect(() => {
    if (!isOrganizerOfRun(runId)) { setNotAllowed(true); setLoading(false); return }
    fetchRun()
  }, [runId, fetchRun])

  async function save() {
    if (saving || !run) return
    setSaving(true)
    setError(null)

    const shareToken = getShareToken(runId)
    if (!shareToken) { setError('No organizer token found.'); setSaving(false); return }

    const res = await fetch(`/api/runs/${runId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-share-token': shareToken,
      },
      body: JSON.stringify({
        title: title.trim(),
        run_date: runDate,
        run_time: runTime,
        location_name: locationName.trim(),
        notes: notes.trim() || null,
        players_needed: playersNeeded,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to save.')
      setSaving(false)
      return
    }

    router.push(`/run/${runId}`)
  }

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <div className="text-white/40 text-lg">Loading...</div>
      </main>
    )
  }

  if (notAllowed) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-xl font-bold text-white mb-2">Not allowed</h1>
        <p className="text-white/50 text-sm">Only the organizer can edit an open run.</p>
        <button onClick={() => router.push(`/run/${runId}`)} className="mt-6 text-orange-400 text-sm underline underline-offset-2">
          ← Back to run
        </button>
      </main>
    )
  }

  return (
    <main className="min-h-dvh flex flex-col p-5 max-w-lg mx-auto">
      <div className="pt-4 mb-8">
        <button onClick={() => router.push(`/run/${runId}`)} className="text-white/40 text-sm mb-4 block">
          ← Back
        </button>
        <h1 className="text-2xl font-black text-white">Edit Run</h1>
        <p className="text-white/40 text-sm mt-1">Changes are live immediately.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-white/50 text-xs uppercase tracking-wider mb-1 block">Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Sunday Runs"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3
                       text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-white/50 text-xs uppercase tracking-wider mb-1 block">Date</label>
            <input
              type="date"
              value={runDate}
              onChange={e => setRunDate(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3
                         text-white focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="text-white/50 text-xs uppercase tracking-wider mb-1 block">Time</label>
            <input
              type="time"
              value={runTime}
              onChange={e => setRunTime(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3
                         text-white focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        <div>
          <label className="text-white/50 text-xs uppercase tracking-wider mb-1 block">Location</label>
          <input
            value={locationName}
            onChange={e => setLocationName(e.target.value)}
            placeholder="Brixton Rec"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3
                       text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500"
          />
        </div>

        <div>
          <label className="text-white/50 text-xs uppercase tracking-wider mb-1 block">Players needed</label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setPlayersNeeded(n => Math.max(2, n - 1))}
              className="w-11 h-11 rounded-xl bg-white/10 text-white font-bold text-lg active:scale-95 transition-transform"
            >−</button>
            <span className="text-2xl font-black text-white w-8 text-center">{playersNeeded}</span>
            <button
              onClick={() => setPlayersNeeded(n => Math.min(30, n + 1))}
              className="w-11 h-11 rounded-xl bg-white/10 text-white font-bold text-lg active:scale-95 transition-transform"
            >+</button>
          </div>
        </div>

        <div>
          <label className="text-white/50 text-xs uppercase tracking-wider mb-1 block">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Bring water, wear trainers..."
            rows={3}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3
                       text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500 resize-none"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}

        <button
          onClick={save}
          disabled={saving || !title.trim() || !locationName.trim()}
          className="w-full py-4 rounded-2xl font-bold text-lg bg-orange-500 text-white
                     active:scale-95 transition-transform disabled:opacity-50 mt-2"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </main>
  )
}
