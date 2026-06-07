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
  saveShareToken,
} from '@/lib/session-token'
import { formatRunDate, formatRunTime } from '@/lib/utils'
import type { RunWithAttendance, AttendanceStatus, GameCommentary } from '@/lib/types'

type GameSummary = {
  id: string
  sequence_number: number
  teams: { id: string; name: string; score: number }[]
  winner_team_id: string | null
  duration_min: number | null
}

type GameComment = {
  id: string
  display_name: string | null
  body: string
  created_at: string
}


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
  const [games, setGames] = useState<GameSummary[]>([])
  const [expandedGame, setExpandedGame] = useState<string | null>(null)
  const [reactions, setReactions] = useState<Record<string, Record<string, number>>>({})
  const [myReactions, setMyReactions] = useState<Record<string, string>>({})
  const [reactingGame, setReactingGame] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string, GameComment[]>>({})
  const [commentInput, setCommentInput] = useState<Record<string, string>>({})
  const [commentName, setCommentName] = useState('')
  const [submittingComment, setSubmittingComment] = useState<string | null>(null)
  const [showNameInput, setShowNameInput] = useState(false)
  const [knownNames, setKnownNames] = useState<string[]>([])

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

  const fetchGames = useCallback(async () => {
    const res = await fetch(`/api/runs/${runId}/games`)
    if (!res.ok) return
    const data = await res.json()
    setGames(data)
    if (data.length > 0) {
      const results = await Promise.all(
        data.map(async (g: GameSummary) => {
          const r = await fetch(`/api/runs/${runId}/games/${g.id}/react`)
          if (!r.ok) return [g.id, {}] as const
          const d = await r.json()
          return [g.id, d] as const
        })
      )
      setReactions(Object.fromEntries(results))
    }
  }, [runId])

  const fetchReactions = useCallback(async (gameList: GameSummary[]) => {
    const results = await Promise.all(
      gameList.map(async g => {
        const res = await fetch(`/api/runs/${runId}/games/${g.id}/react`)
        if (!res.ok) return [g.id, {}] as const
        const data = await res.json()
        return [g.id, data] as const
      })
    )
    setReactions(Object.fromEntries(results))
  }, [runId])

  const fetchComments = useCallback(async (gameId: string) => {
    const res = await fetch(`/api/runs/${runId}/games/${gameId}/comments`)
    if (!res.ok) return
    const data = await res.json()
    setComments(prev => ({ ...prev, [gameId]: data }))
  }, [runId])

  const fetchRun = useCallback(async () => {
    const shareToken = getShareToken(runId)
    const headers: Record<string, string> = {}
    if (shareToken) headers['x-share-token'] = shareToken
    const res = await fetch(`/api/runs/${runId}`, { headers })
    if (!res.ok) { setNotFound(true); setLoading(false); return }
    const data: RunWithAttendance & { isOrganizer?: boolean } = await res.json()
    setRun(data)
    setLoading(false)
    if (data.isOrganizer || isOrganizerOfRun(runId)) {
      setIsOrganizer(true)
      if (data.isOrganizer) {
        const urlToken = new URLSearchParams(window.location.search).get('token')
        if (urlToken) saveShareToken(runId, urlToken)
      }
    }

    const pid = getParticipantId()
    if (pid) {
      const mine = data.attendance.find(a => a.participant_id === pid)
      if (mine) setMyStatus(mine.status)
    }
  }, [runId])

  useEffect(() => {
    fetchRun()
    fetchCommentaries(runId)
    fetchGames()
    const storedName = localStorage.getItem('ballzone:commentName')
    if (storedName) setCommentName(storedName)
    const storedNames = localStorage.getItem('ballzone:knownNames')
    if (storedNames) setKnownNames(JSON.parse(storedNames))
    ;(async () => {
      const stored = localStorage.getItem(`reactions:${runId}`)
      if (stored) setMyReactions(JSON.parse(stored))
    })
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
  }, [runId, fetchRun, fetchCommentaries, fetchGames, fetchReactions, fetchComments])

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
    const token = run?.share_token ? `?token=${run.share_token}` : ''
    navigator.clipboard.writeText(`${appUrl}/run/${runId}${token}`)
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

  async function submitComment(gameId: string) {
    const body = commentInput[gameId]?.trim()
    if (!body || submittingComment) return
    setSubmittingComment(gameId)
    const fingerprint = await getFingerprint()
    const trimmedName = commentName.trim()
    const res = await fetch(`/api/runs/${runId}/games/${gameId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint, display_name: trimmedName || null, body }),
    })
    if (res.ok) {
      const newComment = await res.json()
      setComments(prev => ({ ...prev, [gameId]: [...(prev[gameId] ?? []), newComment] }))
      setCommentInput(prev => ({ ...prev, [gameId]: '' }))
      if (trimmedName) {
        localStorage.setItem('ballzone:commentName', trimmedName)
        setKnownNames(prev => {
          const updated = [trimmedName, ...prev.filter(n => n !== trimmedName)].slice(0, 5)
          localStorage.setItem('ballzone:knownNames', JSON.stringify(updated))
          return updated
        })
        setShowNameInput(false)
      }
    }
    setSubmittingComment(null)
  }

  async function reactToGame(gameId: string, emoji: string) {
    if (reactingGame) return
    setReactingGame(gameId)
    const fingerprint = await getFingerprint()

    // Optimistic update
    const prev = myReactions[gameId]
    const newMyReactions = { ...myReactions }
    const newReactions = { ...reactions }
    const gameCounts = { ...(newReactions[gameId] ?? { '🔥': 0, '💀': 0, '😤': 0, '🏀': 0 }) }

    if (prev === emoji) {
      delete newMyReactions[gameId]
      gameCounts[emoji] = Math.max(0, (gameCounts[emoji] ?? 0) - 1)
    } else {
      if (prev) gameCounts[prev] = Math.max(0, (gameCounts[prev] ?? 0) - 1)
      newMyReactions[gameId] = emoji
      gameCounts[emoji] = (gameCounts[emoji] ?? 0) + 1
    }
    newReactions[gameId] = gameCounts
    setMyReactions(newMyReactions)
    setReactions(newReactions)
    localStorage.setItem(`reactions:${runId}`, JSON.stringify(newMyReactions))

    await fetch(`/api/runs/${runId}/games/${gameId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint, emoji }),
    })
    setReactingGame(null)
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
            <a href={`/run/${runId}/edit${getShareToken(runId) ? `?token=${getShareToken(runId)}` : ``}`} className="btn-secondary text-sm py-2.5 block text-center">
              ✏️ Edit Run
            </a>
            <a href={`/run/${runId}/game${run?.share_token ? `?token=${run.share_token}` : ''}`} className="btn-secondary text-sm py-2.5 block text-center">
              🏀 Keep Score
            </a>
            <a href={`/run/${runId}/backfill`} className="btn-secondary text-sm py-2.5 block text-center">
              📋 Add Historical Game
            </a>
            {run.status === 'open' && (
              <a href={`/run/${runId}/edit${getShareToken(runId) ? `?token=${getShareToken(runId)}` : ``}`} className="btn-secondary text-sm py-2.5 block text-center">
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
      {/* Game History — visible to everyone */}
      {games.length > 0 && (
        <div className="mb-5">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-3">🏀 Game History</p>
          <div className="space-y-3">
            {games.map(g => {
              const commentary = commentaries.find(cm => cm.sequence_number === g.sequence_number)
              const isExpanded = expandedGame === g.id
              return (
                <div key={g.id} className="card border-white/10 overflow-hidden">
                  <button
                    onClick={() => {
                        const next = isExpanded ? null : g.id
                        setExpandedGame(next)
                        if (next && !comments[next]) fetchComments(next)
                      }}
                    className="w-full p-4 text-left active:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white/30 text-xs uppercase tracking-wider">
                        Game {g.sequence_number}
                      </span>
                      <div className="flex items-center gap-2">
                        {g.duration_min !== null && g.duration_min > 0 && (
                          <span className="text-white/30 text-xs">⏱ {g.duration_min}m</span>
                        )}
                        {commentary && <span className="text-white/30 text-xs">🎙</span>}
                        <span className="text-white/30 text-xs">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {g.teams.map(t => (
                        <div key={t.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {t.id === g.winner_team_id && (
                              <span className="text-yellow-400 text-xs">👑</span>
                            )}
                            <span className={t.id === g.winner_team_id ? 'text-sm font-semibold text-white' : 'text-sm font-semibold text-white/50'}>
                              {t.name}
                            </span>
                          </div>
                          <span className={t.id === g.winner_team_id ? 'text-xl font-black tabular-nums text-orange-400' : 'text-xl font-black tabular-nums text-white/30'}>
                            {t.score}
                          </span>
                        </div>
                      ))}
                    </div>
                  </button>
                  {/* Reaction strip */}
                  <div className="px-4 pb-3 flex gap-2">
                    {(['🔥', '💀', '😤', '🏀'] as const).map(emoji => {
                      const count = reactions[g.id]?.[emoji] ?? 0
                      const isMine = myReactions[g.id] === emoji
                      return (
                        <button
                          key={emoji}
                          onClick={() => reactToGame(g.id, emoji)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm transition-all
                            ${isMine
                              ? 'bg-orange-500/30 border border-orange-500/50'
                              : 'bg-white/5 border border-white/10 active:bg-white/10'
                            }`}
                        >
                          <span>{emoji}</span>
                          {count > 0 && (
                            <span className={`text-xs font-semibold ${isMine ? 'text-orange-300' : 'text-white/40'}`}>
                              {count}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t border-white/10">
                      {commentary && (
                        <>
                          <p className="text-white/40 text-xs uppercase tracking-wider mt-3 mb-2">🎙 Commentary</p>
                          <p className="text-white/70 text-sm leading-relaxed mb-4">{commentary.body}</p>
                        </>
                      )}
                      {/* Comments */}
                      <div className="mt-3">
                        <p className="text-white/40 text-xs uppercase tracking-wider mb-3">💬 Comments</p>
                        {(comments[g.id] ?? []).length > 0 && (
                          <div className="space-y-2 mb-3">
                            {(comments[g.id] ?? []).map(cm => (
                              <div key={cm.id} className="flex gap-2">
                                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                  {cm.display_name?.[0]?.toUpperCase() ?? '?'}
                                </div>
                                <div>
                                  <span className="text-white/50 text-xs font-semibold">
                                    {cm.display_name ?? 'Anonymous'}
                                  </span>
                                  <p className="text-white/80 text-sm">{cm.body}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {(comments[g.id] ?? []).length === 0 && (
                          <p className="text-white/20 text-xs italic mb-3">No comments yet. Be first.</p>
                        )}
                        {/* Comment input */}
                        <div className="space-y-2">
                          {/* Name selector */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {knownNames.map(n => (
                              <button
                                key={n}
                                onClick={() => { setCommentName(n); setShowNameInput(false) }}
                                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all
                                  ${commentName === n
                                    ? 'bg-orange-500/30 border-orange-500/50 text-orange-300'
                                    : 'bg-white/5 border-white/10 text-white/40 active:bg-white/10'
                                  }`}
                              >
                                {n}
                              </button>
                            ))}
                            {(knownNames.length === 0 || showNameInput) ? (
                              <input
                                type="text"
                                value={commentName}
                                onChange={e => setCommentName(e.target.value)}
                                placeholder="Your name (optional)"
                                autoFocus={showNameInput}
                                className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5
                                           text-white text-xs placeholder:text-white/20 focus:outline-none
                                           focus:border-orange-500/40"
                              />
                            ) : (
                              <button
                                onClick={() => { setShowNameInput(true); setCommentName('') }}
                                className="w-6 h-6 rounded-full bg-white/10 border border-white/10 text-white/40
                                           text-xs flex items-center justify-center active:bg-white/20"
                              >
                                +
                              </button>
                            )}
                          </div>
                          {/* Comment box + send */}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={commentInput[g.id] ?? ''}
                              onChange={e => setCommentInput(prev => ({ ...prev, [g.id]: e.target.value }))}
                              onKeyDown={e => e.key === 'Enter' && submitComment(g.id)}
                              placeholder="Add a comment..."
                              maxLength={280}
                              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2
                                         text-white text-sm placeholder:text-white/20 focus:outline-none
                                         focus:border-orange-500/50"
                            />
                            <button
                              onClick={() => submitComment(g.id)}
                              disabled={!commentInput[g.id]?.trim() || submittingComment === g.id}
                              className="px-3 py-2 rounded-xl bg-orange-500/80 text-white text-sm font-bold
                                         active:scale-95 transition-transform disabled:opacity-30"
                            >
                              →
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </main>
  )
}
