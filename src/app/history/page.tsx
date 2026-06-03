'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getOrganizerRuns, type OrganizerRunRecord } from '@/lib/session-token'
import { formatRunDate, formatRunTime } from '@/lib/utils'

interface RunWithCounts extends OrganizerRunRecord {
  counts?: { in: number; out: number; late: number }
  status?: string
  loading?: boolean
}

export default function HistoryPage() {
  const [runs, setRuns] = useState<RunWithCounts[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = getOrganizerRuns()
    if (stored.length === 0) { setLoading(false); return }

    setRuns(stored.map(r => ({ ...r, loading: true })))
    setLoading(false)

    // Fetch live counts for each run
    stored.forEach(async (r) => {
      try {
        const res = await fetch(`/api/runs/${r.run_id}`)
        if (!res.ok) return
        const data = await res.json()
        setRuns(prev => prev.map(pr =>
          pr.run_id === r.run_id
            ? { ...pr, counts: data.counts, status: data.status, loading: false }
            : pr
        ))
      } catch {
        setRuns(prev => prev.map(pr =>
          pr.run_id === r.run_id ? { ...pr, loading: false } : pr
        ))
      }
    })
  }, [])

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <div className="text-white/40">Loading...</div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh flex flex-col p-5 max-w-lg mx-auto">
      <div className="pt-4 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Your Runs</h1>
          <p className="text-white/40 text-sm">Runs you&apos;ve organised</p>
        </div>
        <div className="flex gap-2 items-center">
          <Link href="/profile" className="text-white/40 text-sm px-3 py-2 rounded-xl bg-white/10">
            👤
          </Link>
          <Link
            href="/new"
            className="px-4 py-2 rounded-xl bg-orange-500 text-white font-bold text-sm"
          >
            + New Run
          </Link>
        </div>
      </div>

      {runs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="text-5xl mb-4">🏀</div>
          <p className="text-white/50 text-lg mb-2">No runs yet</p>
          <p className="text-white/30 text-sm mb-8">
            Runs you create will appear here
          </p>
          <Link href="/new" className="btn-primary max-w-xs block">
            Create Your First Run
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map(run => (
            <Link
              key={run.run_id}
              href={`/run/${run.run_id}`}
              className="card p-4 block active:scale-[0.98] transition-transform"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="text-white font-bold text-lg leading-tight">
                    {run.title}
                  </h2>
                  <p className="text-orange-400 text-sm mt-0.5">
                    {formatRunDate(run.run_date ?? run.created_at)} · {formatRunTime(run.run_time)}
                  </p>
                  <p className="text-white/40 text-sm mt-0.5">
                    📍 {run.location_name}
                  </p>
                </div>
                <StatusBadge status={run.status} />
              </div>

              {run.loading ? (
                <div className="text-white/20 text-sm">Loading...</div>
              ) : run.counts ? (
                <div className="flex gap-4 mt-3 pt-3 border-t border-white/10">
                  <span className="text-green-400 text-sm font-semibold">
                    ✅ {run.counts.in} in
                  </span>
                  {run.counts.late > 0 && (
                    <span className="text-yellow-400 text-sm font-semibold">
                      ⏰ {run.counts.late} late
                    </span>
                  )}
                  {run.counts.out > 0 && (
                    <span className="text-red-400 text-sm font-semibold">
                      ❌ {run.counts.out} out
                    </span>
                  )}
                </div>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null
  const map: Record<string, { label: string; className: string }> = {
    open:      { label: 'Open',      className: 'bg-green-500/20 text-green-400' },
    active:    { label: 'Live',      className: 'bg-orange-500/20 text-orange-400' },
    completed: { label: 'Done',      className: 'bg-white/10 text-white/40' },
    cancelled: { label: 'Cancelled', className: 'bg-red-500/20 text-red-400' },
    draft:     { label: 'Draft',     className: 'bg-white/10 text-white/40' },
  }
  const config = map[status]
  if (!config) return null
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${config.className}`}>
      {config.label}
    </span>
  )
}
