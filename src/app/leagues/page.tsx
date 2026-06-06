'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type League = {
  id: string
  title: string
  season: string | null
  location_name: string | null
  created_at: string
}

const STORAGE_KEY = 'followed_leagues'

function getFollowed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch { return new Set() }
}

function saveFollowed(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
}

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [loading, setLoading] = useState(true)
  const [followed, setFollowed] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<'following' | 'all'>('following')

  useEffect(() => {
    setFollowed(getFollowed())
    fetch('/api/leagues')
      .then(r => r.json())
      .then(d => { setLeagues(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  function toggleFollow(id: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setFollowed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      saveFollowed(next)
      return next
    })
    // Also persist to DB if signed in
    const token = typeof window !== 'undefined' ? localStorage.getItem('bz_profile_token') : null
    if (token) {
      fetch('/api/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-profile-token': token },
        body: JSON.stringify({ target_id: id, target_type: 'league' }),
      }).catch(() => {})
    }
  }

  const followedLeagues = leagues.filter(l => followed.has(l.id))
  const displayed = tab === 'following' ? followedLeagues : leagues

  return (
    <main className="min-h-dvh flex flex-col p-5 max-w-lg mx-auto pb-10">
      <div className="pt-4 mb-6">
        <p className="text-orange-400 text-xs uppercase tracking-wider font-semibold mb-1">🏆 Leagues</p>
        <h1 className="text-2xl font-black text-white leading-tight">Organised seasons</h1>
      </div>

      {/* Pro Leagues */}
      <div className="mb-5">
        <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mb-3">🏀 Pro Leagues</p>
        <Link href="/pro/nba">
          <div className="card p-4 border-white/10 active:bg-white/5 transition-colors flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30
                            flex items-center justify-center text-lg flex-shrink-0">
              🏀
            </div>
            <div>
              <p className="text-white font-semibold text-sm">NBA</p>
              <p className="text-white/40 text-xs">Season 2025-26</p>
            </div>
            <span className="ml-auto text-white/20 text-sm">→</span>
          </div>
        </Link>
      </div>

      <div className="flex gap-2 mb-5">
        {(['following', 'all'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all
              ${tab === t ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/50'}`}
          >
            {t === 'following'
              ? (followedLeagues.length > 0 ? `🔔 Following (${followedLeagues.length})` : '🔔 Following')
              : '🌐 All Leagues'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-white/40">Loading...</div>
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-4xl mb-4">🏆</div>
          <p className="text-white font-bold text-lg mb-1">
            {tab === 'following' ? 'No leagues followed yet' : 'No leagues yet'}
          </p>
          <p className="text-white/40 text-sm mb-6">
            {tab === 'following'
              ? 'Tap the 🔔 on any league to follow it'
              : 'Be the first to create one'}
          </p>
          {tab === 'following' && (
            <button
              onClick={() => setTab('all')}
              className="px-5 py-2.5 rounded-xl bg-white/10 text-white/70 text-sm font-semibold"
            >
              Browse All Leagues
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {displayed.map(l => (
            <Link key={l.id} href={`/league/${l.id}`}>
              <div className="card p-4 border-white/10 active:bg-white/5 transition-colors flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30
                                  flex items-center justify-center text-lg flex-shrink-0">
                    🏆
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{l.title}</p>
                    <p className="text-white/40 text-xs">
                      {[l.season && `Season ${l.season}`, l.location_name].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={e => toggleFollow(l.id, e)}
                  className={`ml-3 flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-xl
                    transition-all active:scale-90
                    ${followed.has(l.id)
                      ? 'bg-orange-500/20 border border-orange-500/40'
                      : 'bg-white/5 border border-white/10'}`}
                  aria-label={followed.has(l.id) ? 'Unfollow' : 'Follow'}
                >
                  {followed.has(l.id) ? '🔔' : '🔕'}
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Link
        href="/league/new"
        className="w-full py-3 rounded-2xl font-bold text-sm bg-white/10 text-white
                   border border-white/10 flex items-center justify-center active:bg-white/20"
      >
        + Create League
      </Link>
    </main>
  )
}
