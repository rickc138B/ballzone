'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

type Player = {
  id: string
  display_name: string
  team_name: string
  claim_code: string
  claimed_by: string | null
  claimed_at: string | null
}

type ScheduleForm = {
  home_team: string
  away_team: string
  date: string
  time: string
  location_name: string
  round_label: string
}

const emptyForm: ScheduleForm = {
  home_team: '', away_team: '', date: '', time: '',
  location_name: '', round_label: '',
}

export default function LeagueAdminPage() {
  const { id: leagueId } = useParams() as { id: string }
  const [pin, setPin] = useState('')
  const [verified, setVerified] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [pinError, setPinError] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [copied, setCopied] = useState<string | null>(null)

  // Schedule game state
  const [showSchedule, setShowSchedule] = useState(false)
  const [form, setForm] = useState<ScheduleForm>(emptyForm)
  const [scheduling, setScheduling] = useState(false)
  const [scheduleError, setScheduleError] = useState('')
  const [scheduleSuccess, setScheduleSuccess] = useState('')
  const [scheduledGameId, setScheduledGameId] = useState<string | null>(null)
  const [uploadingRecap, setUploadingRecap] = useState(false)
  const [recapUrl, setRecapUrl] = useState<string | null>(null)

  async function verifyPin() {
    setVerifying(true)
    setPinError('')
    const res = await fetch(`/api/leagues/${leagueId}/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
    const data = await res.json()
    setVerifying(false)
    if (!data.valid) {
      if (data.reason === 'too_short') {
        setPinError('PIN must be at least 4 characters')
      } else {
        setPinError('Invalid PIN')
      }
      return
    }
    if (data.pin_set) {
      setPinError('✓ PIN set — remember this for next time')
      setTimeout(() => setPinError(''), 3000)
    }
    setVerified(true)
    loadPlayers()
  }

  async function loadPlayers() {
    const res = await fetch(`/api/leagues/${leagueId}/admin/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
    const data = await res.json()
    if (Array.isArray(data)) setPlayers(data)
  }

  function copy(code: string) {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  async function scheduleGame() {
    setScheduleError('')
    setScheduleSuccess('')
    if (!form.home_team.trim() || !form.away_team.trim()) {
      setScheduleError('Both team names are required'); return
    }
    if (!form.date || !form.time) {
      setScheduleError('Date and time are required'); return
    }
    setScheduling(true)
    const scheduled_at = new Date(`${form.date}T${form.time}`).toISOString()
    const res = await fetch(`/api/leagues/${leagueId}/admin/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin,
        home_team: form.home_team,
        away_team: form.away_team,
        scheduled_at,
        location_name: form.location_name,
        round_label: form.round_label,
      }),
    })
    const data = await res.json()
    setScheduling(false)
    if (!data.success) { setScheduleError(data.error ?? 'Failed to schedule'); return }
    setScheduleSuccess('Game scheduled! ✓')
    setScheduledGameId(data.gameId)
    setForm(emptyForm)
  }

  async function uploadRecapImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !scheduledGameId) return
    setUploadingRecap(true)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const ext = file.name.split('.').pop()
    const uploadPath = `${scheduledGameId}/recap-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('recap-images')
      .upload(uploadPath, file, { upsert: true })
    if (upErr) { setUploadingRecap(false); return }
    const { data: { publicUrl } } = supabase.storage.from('recap-images').getPublicUrl(uploadPath)
    await fetch(`/api/leagues/${leagueId}/game/${scheduledGameId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, recap_image_url: publicUrl }),
    })
    setRecapUrl(publicUrl)
    setUploadingRecap(false)
    setTimeout(() => { setScheduleSuccess(''); setShowSchedule(false); setScheduledGameId(null); setRecapUrl(null) }, 1500)
  }

  const field = (label: string, key: keyof ScheduleForm, type = 'text', placeholder = '') => (
    <div>
      <label className="text-white/40 text-xs uppercase tracking-wider block mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3
                   text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500 text-sm"
      />
    </div>
  )

  return (
    <main className="min-h-dvh flex flex-col p-5 max-w-lg mx-auto">
      <div className="pt-4 mb-6">
        <Link href={`/league/${leagueId}`} className="text-white/40 text-sm mb-4 block">← League</Link>
        <div className="text-3xl mb-2">🔐</div>
        <h1 className="text-2xl font-black text-white">Admin</h1>
        <p className="text-white/40 text-sm mt-1">Manage players and claim codes</p>
      </div>

      {!verified ? (
        <div className="space-y-3">
          <input
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && verifyPin()}
            placeholder="Enter admin PIN"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3
                       text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500"
          />
          {pinError && <p className="text-red-400 text-sm">{pinError}</p>}
          <button
            onClick={verifyPin}
            disabled={!pin.trim() || verifying}
            className="w-full py-3 rounded-2xl font-bold bg-orange-500 text-white
                       disabled:opacity-40 active:scale-95 transition-transform"
          >
            {verifying ? 'Checking...' : 'Unlock →'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Schedule Game */}
          <div className="card p-4 border-orange-500/20">
            <button
              onClick={() => { setShowSchedule(s => !s); setScheduleError(''); setScheduleSuccess('') }}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">📅</span>
                <span className="text-white font-bold text-sm">Schedule Upcoming Game</span>
              </div>
              <span className="text-white/30 text-lg">{showSchedule ? '−' : '+'}</span>
            </button>

            {showSchedule && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {field('Home Team', 'home_team', 'text', 'e.g. Futo Elites')}
                  {field('Away Team', 'away_team', 'text', 'e.g. Jupiters Combine')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {field('Date', 'date', 'date')}
                  {field('Time', 'time', 'time')}
                </div>
                {field('Location', 'location_name', 'text', 'e.g. Stadium (optional)')}
                {field('Label', 'round_label', 'text', 'e.g. Game 2 (optional)')}

                {scheduleError && <p className="text-red-400 text-sm">{scheduleError}</p>}
                {scheduleSuccess && <p className="text-green-400 text-sm">{scheduleSuccess}</p>}

                {scheduledGameId && !recapUrl && (
                  <label className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl
                                    border border-dashed border-white/20 text-white/40 text-sm cursor-pointer
                                    active:bg-white/5 transition-colors">
                    {uploadingRecap ? 'Uploading...' : '📸 Add game photo (optional)'}
                    <input type="file" accept="image/*" className="hidden" onChange={uploadRecapImage} disabled={uploadingRecap} />
                  </label>
                )}
                {recapUrl && (
                  <div className="rounded-2xl overflow-hidden aspect-video">
                    <img src={recapUrl} alt="Recap" className="w-full h-full object-cover" />
                  </div>
                )}

                <button
                  onClick={scheduleGame}
                  disabled={scheduling}
                  className="w-full py-3 rounded-2xl font-bold bg-orange-500 text-white
                             disabled:opacity-40 active:scale-95 transition-transform text-sm"
                >
                  {scheduling ? 'Scheduling...' : '📅 Schedule Game'}
                </button>
              </div>
            )}
          </div>

          {/* Players */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/40 text-sm">{players.length} players</p>
              <button onClick={loadPlayers} className="text-white/30 text-xs underline">Refresh</button>
            </div>

            {players.length === 0 && (
              <p className="text-white/20 text-sm text-center py-8">No players yet</p>
            )}

            {Array.from(new Set(players.map(p => p.team_name))).map(team => (
              <div key={team} className="mb-4">
                <p className="text-orange-400 text-xs uppercase tracking-wider font-semibold mb-2">{team}</p>
                <div className="space-y-2">
                  {players.filter(p => p.team_name === team).map(p => (
                    <div key={p.id} className="card p-3 border-white/5 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-semibold">{p.display_name}</span>
                          {p.claimed_by
                            ? <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded-full">✓ Claimed</span>
                            : <span className="text-xs bg-white/5 text-white/30 px-1.5 py-0.5 rounded-full">Unclaimed</span>
                          }
                        </div>
                        <p className="text-white/30 text-xs font-mono mt-0.5">{p.claim_code}</p>
                      </div>
                      <button
                        onClick={() => copy(p.claim_code)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all
                          ${copied === p.claim_code
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-white/10 text-white/50 border border-white/10 active:bg-white/20'}`}
                      >
                        {copied === p.claim_code ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
