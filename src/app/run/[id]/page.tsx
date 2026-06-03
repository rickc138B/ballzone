'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { getFingerprint } from '@/lib/fingerprint'
import {
  getParticipantId,
  saveParticipantId,
  getParticipantName,
  saveParticipantName,
  isOrganizerOfRun,
  getShareToken,
} from '@/lib/session-token'
import { formatRunDate, formatRunTime } from '@/lib/utils'
import type { RunWithAttendance, AttendanceStatus, GameCommentary } from '@/lib/types'

export default function RunPage() {
  const params = useParams()
  const runId = params.id as string

  const [run, setRun] = useState<RunWithAttendance | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [myStatus, setMyStatus] = useState<AttendanceStatus | null>(null)
  const [responding, setResponding] = useState(false)
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [name, setName] = useState('')
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedList, setCopiedList] = useState(false)
  const [copiedReminder, setCopiedReminder] = useState(false)
  const [commentaries, setCommentaries] = useState<Array<GameCommentary & { sequence_number: number }>>([])

  const fetchCommentaries = useCallback(async (rid: string) => {
    // get completed games for this run
    const supabase = (await import('@/lib/supabase')).getSupabase()
    const { data: games } = await supabase
      .from('games')
      .select('id, sequence_number, session_id')
      .eq('session_id', rid)
      .eq('status', 'complete')
      .order('sequence_number', { ascending: true })
    if (!games || games.length === 0) return
    const results = await Promise.all(
      games.map(async g => {
        const res = await fetch(`/api/runs/${rid}/games/${g.id}/commentary`)
        if (!res.ok) return null
        const d = await res.json()
        if (!d.body) return null
        return { ...d, sequence_number: g.sequence_number }
      })
    )
    setCommentaries(results.filter(Boolean))
  }, [])

  const fetchRun = useCallback(async () => {
    const res = await fetch(`/api/runs/${runId}`)
    if (!res.ok) { setNotFound(true); setLoading(false); return }
    const data: RunWithAttendance = await res.json()
    setRun(data)
    setLoading(false)

    const pid = getParticipantId()
    if (pid) {
      const mine = data.attendance.find(a => a.participant_id === pid)
      if (mine) setMyStatus(mine.status)
    }
  }, [runId])

  useEffect(() => {
    fetchRun()
    fetchCommentaries(runId)
    setIsOrganizer(isOrganizerOfRun(runId))
    setName(getParticipantName())

    // Realtime subscription
    const supabase = getSupabase()
    const channel = supabase
      .channel(`run:${runId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'attendance',
        filter: `run_id=eq.${runId}`,
      }, () => { fetchRun() })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [runId, fetchRun, fetchCommentaries])

  async function respond(status: AttendanceStatus) {
    if (responding) return
    setResponding(true)

    const fingerprint = await getFingerprint()
    const participant_id = getParticipantId() || undefined

    const res = await fetch(`/api/runs/${runId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        fingerprint,
        participant_id,
        display_name: getParticipantName() || undefined,
      }),
    })

    const data = await res.json()
    if (res.ok) {
      saveParticipantId(data.participant_id)
      setMyStatus(status)
      if (!getParticipantName()) setShowNamePrompt(true)
    }

    setResponding(false)
  }

  async function saveName() {
    if (!name.trim()) { setShowNamePrompt(false); return }
    saveParticipantName(name.trim())

    const fingerprint = await getFingerprint()
    await fetch(`/api/runs/${runId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: myStatus,
        fingerprint,
        participant_id: getParticipantId(),
        display_name: name.trim(),
      }),
    })

    setShowNamePrompt(false)
    fetchRun()
  }

  async function startGame() {
    const shareToken = getShareToken(runId)
    if (!shareToken) return
    await fetch(`/api/runs/${runId}/start`, {
      method: 'POST',
      headers: { 'x-share-token': shareToken },
    })
    fetchRun()
  }

  function copyLink() {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
    navigator.clipboard.writeText(`${appUrl}/run/${runId}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copyAttendanceList() {
    if (!run) return
    const lines: string[] = []
    const inNames = run.attendance
      .filter(a => a.status === 'in')
      .map(a => a.participant?.display_name ?? 'Anonymous')
      .sort()
    const lateNames = run.attendance
      .filter(a => a.status === 'late')
      .map(a => a.participant?.display_name ?? 'Anonymous')
      .sort()
    const outNames = run.attendance
      .filter(a => a.status === 'out')
      .map(a => a.participant?.display_name ?? 'Anonymous')
      .sort()
    if (inNames.length)   lines.push(`✅ IN: ${inNames.join(', ')}`)
    if (lateNames.length) lines.push(`⏰ LATE: ${lateNames.join(', ')}`)
    if (outNames.length)  lines.push(`❌ OUT: ${outNames.join(', ')}`)
    navigator.clipboard.writeText(lines.join('\n'))
    setCopiedList(true)
    setTimeout(() => setCopiedList(false), 2000)
  }

  function copyReminder() {
    if (!run) return
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
    const url = `${appUrl}/run/${runId}`
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const runDay = new Date(run.run_date + 'T00:00:00')
    const diffDays = Math.round((runDay.getTime() - today.getTime()) / 86400000)
    const dayLabel =
      diffDays === 0 ? 'TODAY' :
      diffDays === 1 ? 'TOMORROW' :
      runDay.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase()
    const still = Math.max(0, run.players_needed - run.counts.in)
    const lines = [
      `Reminder 🏀 ${run.title}`,
      `${dayLabel} ${formatRunTime(run.run_time)} · ${run.location_name}`,
      `${run.counts.in}/${run.players_needed} confirmed${still > 0 ? ` · Still need ${still}` : " · We\'re full!"}`,
      `→ ${url}`,
    ]
    navigator.clipboard.writeText(lines.join('\n'))
    setCopiedReminder(true)
    setTimeout(() => setCopiedReminder(false), 2000)
  }

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <div className="text-white/40 text-lg">Loading...</div>
      </main>
    )
  }

  if (notFound || !run) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-4">🏀</div>
        <h1 className="text-xl font-bold text-white mb-2">Run not found</h1>
        <p className="text-white/50 text-sm">This link may have expired or been cancelled.</p>
      </main>
    )
  }

  const isCancelled = run.status === 'cancelled'
  const isCompleted = run.status === 'completed'

  return (
    <main className="min-h-dvh flex flex-col p-5 max-w-lg mx-auto">
      {/* Header */}
      <div className="pt-4 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-white leading-tight">{run.title}</h1>
            <p className="text-orange-400 font-semibold mt-1">
              {formatRunDate(run.run_date)} · {formatRunTime(run.run_time)}
            </p>
            <p className="text-white/50 text-sm mt-0.5">📍 {run.location_name}</p>
          </div>
          <div className="text-3xl">🏀</div>
        </div>
        {run.notes && (
          <p className="text-white/40 text-sm mt-2 italic">{run.notes}</p>
        )}
      </div>

      {/* Counts */}
      <div className="card p-4 mb-5">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-3xl font-black text-green-400">{run.counts.in}</div>
            <div className="text-white/50 text-xs mt-0.5">IN</div>
          </div>
          <div>
            <div className="text-3xl font-black text-yellow-400">{run.counts.late}</div>
            <div className="text-white/50 text-xs mt-0.5">LATE</div>
          </div>
          <div>
            <div className="text-3xl font-black text-red-400">{run.counts.out}</div>
            <div className="text-white/50 text-xs mt-0.5">OUT</div>
          </div>
        </div>
        <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, (run.counts.in / run.players_needed) * 100)}%` }}
          />
        </div>
        <p className="text-white/40 text-xs text-center mt-1.5">
          {run.counts.in} / {run.players_needed} confirmed
        </p>
      </div>

      {/* Response buttons (non-organizer, non-cancelled) */}
      {!isCancelled && !isCompleted && (
        <div className="space-y-3 mb-5">
          {[
            { status: 'in' as const, label: "✅ I'M IN", active: 'bg-green-500', inactive: 'bg-white/10' },
            { status: 'late' as const, label: "⏰ I'M LATE", active: 'bg-yellow-500', inactive: 'bg-white/10' },
            { status: 'out' as const, label: "❌ I'M OUT", active: 'bg-red-500', inactive: 'bg-white/10' },
          ].map(({ status, label, active, inactive }) => (
            <button
              key={status}
              onClick={() => respond(status)}
              disabled={responding}
              className={`w-full py-4 rounded-2xl font-bold text-lg text-white
                          active:scale-95 transition-all duration-150
                          ${myStatus === status ? active : inactive}
                          ${myStatus === status ? 'ring-2 ring-white/30' : 'border border-white/10'}
                          disabled:opacity-50`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {isCancelled && (
        <div className="card p-4 mb-5 text-center">
          <p className="text-red-400 font-semibold">This run has been cancelled.</p>
        </div>
      )}

      {/* Name prompt */}
      {showNamePrompt && (
        <div className="card p-4 mb-5">
          <p className="text-white font-semibold mb-1">
            You&apos;re {myStatus === 'in' ? 'IN 🎉' : myStatus === 'late' ? 'LATE ⏰' : 'OUT'}
          </p>
          <p className="text-white/50 text-sm mb-3">What should we call you? (optional)</p>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveName()}
            placeholder="Your name"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 
                       text-white placeholder:text-white/30 focus:outline-none 
                       focus:border-orange-500 mb-3"
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={saveName} className="flex-1 py-2.5 rounded-xl bg-orange-500 font-semibold text-white">
              Save
            </button>
            <button onClick={() => setShowNamePrompt(false)} className="flex-1 py-2.5 rounded-xl bg-white/10 font-semibold text-white/60">
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Who's coming */}
      {run.attendance.length > 0 && (
        <div className="card p-4 mb-5">
          <p className="text-white/50 text-xs uppercase tracking-wider mb-3">Who&apos;s coming</p>
          <div className="flex flex-wrap gap-2">
            {run.attendance
              .filter(a => a.status !== 'out')
              .map(a => (
                <span
                  key={a.id}
                  className={`text-sm px-3 py-1 rounded-full font-medium
                    ${a.status === 'in' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}
                >
                  {a.participant?.display_name ?? 'Anonymous'}
                  {a.status === 'late' ? ' ⏰' : ''}
                </span>
              ))}
          </div>
          {run.attendance.filter(a => a.status === 'out').length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-white/30 text-xs mb-1">Can&apos;t make it</p>
              <div className="flex flex-wrap gap-2">
                {run.attendance
                  .filter(a => a.status === 'out')
                  .map(a => (
                    <span key={a.id} className="text-sm px-3 py-1 rounded-full bg-red-500/10 text-red-400">
                      {a.participant?.display_name ?? 'Anonymous'}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Organizer controls */}
      {isOrganizer && (
        <div className="card p-4 mb-5 border-orange-500/30">
          <p className="text-orange-400 text-xs uppercase tracking-wider mb-3 font-semibold">
            Organizer Controls
          </p>
          <div className="space-y-2">
            <button onClick={copyLink} className="btn-secondary text-sm py-2.5">
              {copied ? '✓ Copied!' : '🔗 Share Link'}
            </button>
            <button onClick={copyAttendanceList} className="btn-secondary text-sm py-2.5">
              {copiedList ? '✓ Copied!' : '📋 Copy Attendance List'}
            </button>
            <button onClick={copyReminder} className="btn-secondary text-sm py-2.5">
              {copiedReminder ? '✓ Copied!' : '📣 Copy Reminder'}
            </button>
            <a href={`/run/${runId}/edit`} className="btn-secondary text-sm py-2.5 block text-center">
              ✏️ Edit Run
            </a>
            <a href={`/run/${runId}/game`} className="btn-secondary text-sm py-2.5 block text-center">
              🏀 Keep Score
            </a>
            <a href={`/run/${runId}/backfill`} className="btn-secondary text-sm py-2.5 block text-center">
              📋 Add Historical Game
            </a>
            {run.status === 'open' && (
              <a href={`/run/${runId}/edit`} className="btn-secondary text-sm py-2.5 block text-center">
                ✏️ Edit Run
              </a>
            )}
            {run.status === 'open' && (
              <button
                onClick={startGame}
                className="w-full py-3 rounded-2xl font-bold text-base bg-orange-500 
                           text-white active:scale-95 transition-transform"
              >
                🏀 Start Game
              </button>
            )}
          </div>
        </div>
      )}
      {/* Game commentaries — visible to everyone on completed runs */}
      {commentaries.length > 0 && (
        <div className="mb-5">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-3">🎙 Game Commentary</p>
          <div className="space-y-3">
            {commentaries.map(c => (
              <div key={c.id} className="card p-4 border-white/10">
                <p className="text-white/30 text-xs mb-2">Game {c.sequence_number}</p>
                <p className="text-white/80 text-sm leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
