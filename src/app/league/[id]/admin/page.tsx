'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type Player = {
  id: string
  display_name: string
  team_name: string
  claim_code: string
  claimed_by: string | null
  claimed_at: string | null
}

export default function LeagueAdminPage() {
  const { id: leagueId } = useParams() as { id: string }
  const [pin, setPin] = useState('')
  const [verified, setVerified] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [pinError, setPinError] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [copied, setCopied] = useState<string | null>(null)

  async function verifyPin() {
    setVerifying(true)
    setPinError('')
    const res = await fetch(`/api/leagues/${leagueId}/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
    const data = await res.json()
    if (!data.valid) { setPinError('Invalid PIN'); setVerifying(false); return }
    setVerified(true)
    loadPlayers()
    setVerifying(false)
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
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white/40 text-sm">{players.length} players</p>
            <button onClick={loadPlayers} className="text-white/30 text-xs underline">Refresh</button>
          </div>

          {players.length === 0 && (
            <p className="text-white/20 text-sm text-center py-8">No players yet</p>
          )}

          {/* Group by team */}
          {Array.from(new Set(players.map(p => p.team_name))).map(team => (
            <div key={team}>
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
      )}
    </main>
  )
}
