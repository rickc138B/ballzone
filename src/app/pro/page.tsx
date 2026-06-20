'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type LeagueRow = {
  id: string; name: string; slug: string; region: string | null
  current_season: { slug: string; label: string } | null
}

export default function ProLeaguesIndexPage() {
  const [leagues, setLeagues] = useState<LeagueRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/pro/leagues')
      .then(r => r.json())
      .then(d => { setLeagues(d.leagues ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <main className="min-h-dvh flex flex-col max-w-lg mx-auto pb-16">
      <div className="pt-16 pb-6 px-5 border-b border-white/5">
        <p className="text-orange-400 text-xs uppercase tracking-wider font-semibold mb-1">🏀 Pro</p>
        <h1 className="text-3xl font-black text-white">Leagues</h1>
        <p className="text-white/30 text-sm mt-0.5">Stats, standings, and games</p>
      </div>

      <div className="px-5 pt-5 flex flex-col gap-3">
        {loading && <div className="text-white/30 text-sm text-center py-12">Loading...</div>}
        {!loading && leagues.length === 0 && (
          <div className="text-white/30 text-sm text-center py-12">No leagues yet.</div>
        )}
        {leagues.map(l => (
          <Link
            key={l.id}
            href={l.current_season ? `/pro/${l.slug}/${l.current_season.slug}` : `/pro/${l.slug}`}
            className="card p-4 flex items-center justify-between active:bg-white/5"
          >
            <div>
              <p className="text-white font-bold">{l.name}</p>
              <p className="text-white/30 text-xs mt-0.5">
                {l.current_season ? l.current_season.label : l.region}
              </p>
            </div>
            <span className="text-white/20 text-lg">→</span>
          </Link>
        ))}
      </div>
    </main>
  )
}
