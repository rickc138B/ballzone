'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getProfileToken,
  saveProfileToken,
  saveProfileId,
  clearProfile,
  isClaimed,
  getParticipantId,
  getOrCreateSessionToken,
  hashToken,
} from '@/lib/session-token'
import type { Profile, ProfileStats } from '@/lib/types'

type Step = 'loading' | 'unclaimed' | 'enter_email' | 'enter_otp' | 'claimed'

export default function ProfilePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('loading')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingName, setEditingName] = useState(false)
 const [isClaiming, setIsClaiming] = useState(false)
 const [followCounts, setFollowCounts] = useState<{ following: number; followers: number } | null>(null)
  const [followModal, setFollowModal] = useState<'following' | 'followers' | null>(null)
  const [followList, setFollowList] = useState<any[]>([])
  const [followListLoading, setFollowListLoading] = useState(false)

  useEffect(() => {
    const claiming = typeof window !== 'undefined' && !!localStorage.getItem('bz_participant_id')
    setIsClaiming(claiming)
    if (isClaimed()) { fetchProfile() } else { setStep('unclaimed') }
  }, [])

  async function fetchProfile() {
    setStep('loading')
    const res = await fetch('/api/profile', {
      headers: { 'x-profile-token': getProfileToken() },
    })
    if (!res.ok) { clearProfile(); setStep('unclaimed'); return }
    const data = await res.json()
    setProfile(data); setStats(data.stats)
    setDisplayName(data.display_name ?? '')
    setStep('claimed')
   // Fetch follow counts
   const token = getProfileToken()
   fetch('/api/profile/follow-counts', { headers: { 'x-profile-token': token } })
     .then(r => r.json()).then(d => setFollowCounts(d))
 }

  async function requestOtp() {
    if (!email.trim() || !email.includes('@')) { setError('Enter a valid email'); return }
    setBusy(true); setError('')
    const res = await fetch('/api/auth/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })
    setBusy(false)
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed to send code'); return }
    setStep('enter_otp')
  }

  async function verifyOtp() {
    if (!otp.trim()) { setError('Enter the code'); return }
    setBusy(true); setError('')

    const participant_id = getParticipantId() || undefined
    const sessionToken = getOrCreateSessionToken()
    const organizer_token_hash = sessionToken ? await hashToken(sessionToken) : undefined

    const res = await fetch('/api/auth/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), code: otp.trim(), participant_id, organizer_token_hash }),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) { setError(data.error ?? 'Invalid code'); return }

    saveProfileToken(data.profile_token)
    saveProfileId(data.profile_id)
    await fetchProfile()
  }

  async function saveName() {
    if (!displayName.trim()) return
    setBusy(true)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-profile-token': getProfileToken() },
      body: JSON.stringify({ display_name: displayName.trim() }),
    })
    setBusy(false)
    if (res.ok) { const data = await res.json(); setProfile(data); setEditingName(false) }
  }

  function signOut() {
    clearProfile(); setStep('unclaimed'); setProfile(null); setStats(null)
  }

  async function openFollowModal(type: 'following' | 'followers') {
    setFollowModal(type)
    setFollowList([])
    setFollowListLoading(true)
    const token = getProfileToken()
    const res = await fetch(`/api/profile/follow-list?type=${type}`, {
      headers: { 'x-profile-token': token }
    })
    const d = await res.json()
    setFollowList(d.items ?? [])
    setFollowListLoading(false)
  }

  if (step === 'loading') return (
    <main className="min-h-dvh flex items-center justify-center">
      <div className="text-white/40">Loading...</div>
    </main>
  )

  if (step === 'unclaimed') return (
    <main className="min-h-dvh flex flex-col p-6 max-w-lg mx-auto">
      <div className="pt-4 mb-8">
        <button onClick={() => router.back()} className="text-white/40 text-sm mb-4 block">← Back</button>
        <h1 className="text-2xl font-black text-white">{isClaiming ? 'One more step' : 'Claim your profile'}</h1>
        <p className="text-white/50 text-sm mt-1">{isClaiming ? 'Sign in to complete your player profile claim' : 'Link your runs and stats across devices'}</p>
      </div>
      <div className="card p-5 mb-6">
        <div className="space-y-3 text-white/60 text-sm">
          <p>✅ Access your runs from any device</p>
          <p>📊 Track your points and games played</p>
          <p>🏀 Get credit for scores you made</p>
        </div>
      </div>
      <button
        onClick={() => setStep('enter_email')}
        className="w-full py-4 rounded-2xl font-bold text-lg bg-orange-500 text-white active:scale-95 transition-transform"
      >
        {isClaiming ? 'Sign in to claim →' : 'Continue with Email'}
      </button>
      <p className="text-white/20 text-xs text-center mt-4">Players, fans and organisers welcome</p>
    </main>
  )

  if (step === 'enter_email') return (
    <main className="min-h-dvh flex flex-col p-6 max-w-lg mx-auto">
      <div className="pt-4 mb-8">
        <button onClick={() => setStep('unclaimed')} className="text-white/40 text-sm mb-4 block">← Back</button>
        <h1 className="text-2xl font-black text-white">Enter your email</h1>
        <p className="text-white/50 text-sm mt-1">We'll send a 6-digit code</p>
      </div>
      <div className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && requestOtp()}
          placeholder="you@example.com"
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3
                     text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500 text-lg"
          autoFocus
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button onClick={requestOtp} disabled={busy}
          className="w-full py-4 rounded-2xl font-bold text-lg bg-orange-500 text-white
                     active:scale-95 transition-transform disabled:opacity-50">
          {busy ? 'Sending...' : 'Send Code →'}
        </button>
      </div>
    </main>
  )

  if (step === 'enter_otp') return (
    <main className="min-h-dvh flex flex-col p-6 max-w-lg mx-auto">
      <div className="pt-4 mb-8">
        <button onClick={() => setStep('enter_email')} className="text-white/40 text-sm mb-4 block">← Back</button>
        <h1 className="text-2xl font-black text-white">Check your email</h1>
        <p className="text-white/50 text-sm mt-1">Code sent to {email}</p>
      </div>
      <div className="space-y-4">
        <input
          type="text"
          inputMode="numeric"
          value={otp}
          onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={e => e.key === 'Enter' && verifyOtp()}
          placeholder="000000"
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3
                     text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500
                     text-3xl font-black text-center tracking-[0.5em]"
          autoFocus
        />
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <button onClick={verifyOtp} disabled={busy || otp.length < 6}
          className="w-full py-4 rounded-2xl font-bold text-lg bg-orange-500 text-white
                     active:scale-95 transition-transform disabled:opacity-50">
          {busy ? 'Verifying...' : 'Verify →'}
        </button>
        <button onClick={() => { setStep('enter_email'); setOtp(''); setError('') }}
          className="w-full py-2 text-white/30 text-sm">
          Resend code
        </button>
      </div>
    </main>
  )

  const initials = (profile?.display_name ?? email)
    .split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <main className="min-h-dvh flex flex-col p-6 max-w-lg mx-auto">
      <div className="pt-4 mb-6">
        <button onClick={() => router.back()} className="text-white/40 text-sm mb-4 block">← Back</button>
        <h1 className="text-2xl font-black text-white">Profile</h1>
      </div>
      <div className="card p-5 mb-4 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-orange-500/20 border border-orange-500/30
                        flex items-center justify-center text-orange-400 text-xl font-black flex-shrink-0">
          {initials || '?'}
        </div>
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex gap-2">
              <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveName()}
                className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2
                           text-white focus:outline-none focus:border-orange-500 text-sm" autoFocus />
              <button onClick={saveName} disabled={busy}
                className="px-3 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold disabled:opacity-50">
                Save
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-white font-bold text-lg truncate">
                {profile?.display_name ?? 'No name set'}
              </p>
              <button onClick={() => setEditingName(true)} className="text-white/30 text-xs">✏️</button>
            </div>
          )}
          <p className="text-white/40 text-sm">{profile?.email}</p>
        </div>
      </div>

      {stats && (
        <div className="card p-4 mb-4">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Your Stats</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-2xl font-black text-orange-400">{stats.runs_organised}</div>
              <div className="text-white/40 text-xs mt-0.5">Runs Organised</div>
            </div>
            <div>
              <div className="text-2xl font-black text-green-400">{stats.games_played}</div>
              <div className="text-white/40 text-xs mt-0.5">Games Played</div>
            </div>
            <div>
              <div className="text-2xl font-black text-white">{stats.points_scored}</div>
              <div className="text-white/40 text-xs mt-0.5">Points Scored</div>
            </div>
          </div>
        </div>
      )}

      {followCounts !== null && (
        <div className="card p-4 mb-4">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Network</p>
          <div className="grid grid-cols-2 gap-3 text-center">
            <button onClick={() => openFollowModal('following')} className="active:opacity-70">
              <div className="text-2xl font-black text-white">{followCounts.following}</div>
              <div className="text-white/40 text-xs mt-0.5">Following</div>
            </button>
            <button onClick={() => openFollowModal('followers')} className="active:opacity-70">
              <div className="text-2xl font-black text-white">{followCounts.followers}</div>
              <div className="text-white/40 text-xs mt-0.5">Followers</div>
            </button>
          </div>
        </div>
      )}

      <button onClick={signOut}
        className="w-full py-3 rounded-2xl font-semibold text-white/30 border border-white/10 text-sm mt-2">
        Sign out
      </button>

      {/* Follow modal */}
      {followModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setFollowModal(null)}>
          <div className="w-full max-w-lg bg-[#0f0f1a] border border-white/10 rounded-t-2xl p-5 pb-10 max-h-[70vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-black text-lg capitalize">{followModal}</h2>
              <button onClick={() => setFollowModal(null)} className="text-white/30 text-sm">✕</button>
            </div>
            {followListLoading ? (
              <div className="text-white/30 text-sm py-8 text-center">Loading...</div>
            ) : followList.length === 0 ? (
              <div className="text-white/30 text-sm py-8 text-center">Nothing here yet</div>
            ) : (
              <div className="overflow-y-auto space-y-2">
                {followList.map((item: any) => (
                  <a key={item.id} href={item.href}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 active:bg-white/10">
                    <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/30
                                    flex items-center justify-center text-base flex-shrink-0">
                      {item.emoji}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{item.name}</p>
                      <p className="text-white/30 text-xs">{item.subtitle}</p>
                    </div>
                    <span className="ml-auto text-white/20 text-xs">→</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
