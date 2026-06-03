'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function LeagueBackfillPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [json, setJson] = useState('')
  const [parsed, setParsed] = useState<any>(null)
  const [parseError, setParseError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function parseJson() {
    try {
      const data = JSON.parse(json)
      if (!data.home_team || !data.away_team) throw new Error('Missing home_team or away_team')
      if (!Array.isArray(data.home_team.players) || !Array.isArray(data.away_team.players)) throw new Error('Players must be arrays')
      setParsed(data)
      setParseError('')
    } catch (e: any) {
      setParseError(e.message)
      setParsed(null)
    }
  }

  async function save() {
    if (!parsed) return
    setSaving(true)
    const res = await fetch(`/api/leagues/${id}/backfill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setSaving(false); return }
    router.push(`/league/${id}/game/${data.game_id}`)
  }

  const homeScore = parsed?.home_team?.players?.reduce((s: number, p: any) => s + (p.pts ?? 0), 0) ?? 0
  const awayScore = parsed?.away_team?.players?.reduce((s: number, p: any) => s + (p.pts ?? 0), 0) ?? 0

  return (
    <main className="min-h-dvh flex flex-col p-5 max-w-lg mx-auto">
      <div className="pt-4 mb-6">
        <button onClick={() => router.back()} className="text-white/40 text-sm mb-4 block">← Back</button>
        <div className="text-3xl mb-2">📋</div>
        <h1 className="text-2xl font-black text-white">Add Game Result</h1>
        <p className="text-white/40 text-sm mt-1">Paste the game JSON to import a full box score</p>
      </div>

      <div className="space-y-4">
        <textarea
          value={json}
          onChange={e => { setJson(e.target.value); setParsed(null); setParseError('') }}
          placeholder={'{\n  "game": { "round_label": "Game 1" },\n  "home_team": { "name": "Team A", "players": [...] },\n  "away_team": { "name": "Team B", "players": [...] }\n}'}
          rows={10}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3
                     text-white text-xs font-mono placeholder:text-white/20 focus:outline-none
                     focus:border-orange-500/50 resize-none"
        />

        {parseError && <p className="text-red-400 text-xs">{parseError}</p>}

        {!parsed && (
          <button
            onClick={parseJson}
            disabled={!json.trim()}
            className="w-full py-3 rounded-2xl font-bold bg-white/10 text-white border border-white/10
                       active:scale-95 transition-transform disabled:opacity-30"
          >
            Parse JSON →
          </button>
        )}

        {/* Preview */}
        {parsed && (
          <div className="space-y-4">
            <div className="card p-4 border-orange-500/20">
              <p className="text-orange-400 text-xs uppercase tracking-wider mb-3">Preview</p>

              {parsed.game?.round_label && (
                <p className="text-white/40 text-xs mb-3">{parsed.game.round_label} · {parsed.game.location_name ?? ''}</p>
              )}

              {/* Score summary */}
              <div className="space-y-2 mb-4">
                {[
                  { name: parsed.home_team.name, score: homeScore },
                  { name: parsed.away_team.name, score: awayScore },
                ].sort((a, b) => b.score - a.score).map((t, i) => (
                  <div key={t.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {i === 0 && <span className="text-yellow-400 text-xs">👑</span>}
                      <span className={i === 0 ? 'text-white font-semibold' : 'text-white/50'}>
                        {t.name}
                      </span>
                    </div>
                    <span className={i === 0 ? 'text-orange-400 font-black text-xl' : 'text-white/30 font-black text-xl'}>
                      {t.score}
                    </span>
                  </div>
                ))}
              </div>

              {/* Player stat previews */}
              {[{ label: parsed.home_team.name, players: parsed.home_team.players }, { label: parsed.away_team.name, players: parsed.away_team.players }].map(team => (
                <div key={team.label} className="mb-3">
                  <p className="text-white/30 text-xs font-semibold mb-2">{team.label} — {team.players.length} players</p>
                  <div className="space-y-1">
                    {team.players.map((p: any) => (
                      <div key={p.name} className="flex items-center justify-between text-xs">
                        <span className="text-white/60">{p.name}</span>
                        <span className="text-white/30 tabular-nums">
                          {p.pts}pts · {p.reb}reb · {p.ast}ast
                          {p.stl ? ` · ${p.stl}stl` : ''}
                          {p.blk ? ` · ${p.blk}blk` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => setParsed(null)}
                className="flex-1 py-3 rounded-2xl font-bold bg-white/10 text-white/60 border border-white/10"
              >
                Edit
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 py-3 rounded-2xl font-bold bg-orange-500 text-white
                           active:scale-95 transition-transform disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Game →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
