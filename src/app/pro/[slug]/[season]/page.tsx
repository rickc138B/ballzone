'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import ClipsTab from '@/components/ClipsTab'

type Season = { id: string; label: string; slug: string; is_current: boolean; start_date: string | null; end_date: string | null }

type PlayerSeason = {
  id: string
  pts: number; reb: number; ast: number; stl: number; blk: number
  games_played: number; fg_pct: number; three_pct: number
  player: { id: string; name: string; nationality: string | null; photo_url: string | null }
  team: { id: string; name: string; abbreviation: string }
}

type Team = {
  id: string; name: string; abbreviation: string; logo_url: string | null
  conference?: string | null; is_dq?: boolean
}

type Standing = {
  id: string; games_played: number; wins: number; losses: number
  points_for: number; points_against: number; win_pct: number | null
  playoff_seed?: number | null
  team: { id: string; name: string; conference: string | null; is_dq: boolean }
}

type PlayerGameStat = {
  id: string; name: string
  pts: number; reb: number; ast: number; stl: number; blk: number; tov: number
  fgm: number; fga: number; three_pm: number; three_pa: number; ftm: number; fta: number
  minutes: string
}

type Game = {
  id: string
  game_date: string
  home_team: { id: string; name: string; abbreviation: string }
  away_team: { id: string; name: string; abbreviation: string }
  home_score: number | null
  away_score: number | null
  home_players: PlayerGameStat[]
  away_players: PlayerGameStat[]
}

type ProLeagueData = {
  league: { id: string; name: string; slug: string; season: string; region: string }
  season: Season
  seasons: Season[]
  players: PlayerSeason[]
  teams: Team[]
  standings: Standing[]
}

const STAT_CATS = ['pts', 'reb', 'ast', 'stl', 'blk'] as const
type StatCat = typeof STAT_CATS[number]

const STAT_LABELS: Record<StatCat, string> = {
  pts: 'Points', reb: 'Rebounds', ast: 'Assists', stl: 'Steals', blk: 'Blocks'
}

function BoxScoreTable({ players, teamName, score, won }: {
  players: PlayerGameStat[]
  teamName: string
  score: number
  won: boolean
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className={`text-sm font-black ${won ? 'text-white' : 'text-white/50'}`}>
          {won && '👑 '}{teamName}
        </span>
        <span className={`text-xl font-black tabular-nums ${won ? 'text-orange-400' : 'text-white/30'}`}>
          {score}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-white/20 uppercase tracking-wider border-b border-white/10">
              <th className="text-left px-2 py-1.5">Player</th>
              <th className="text-center px-1 py-1.5">MIN</th>
              <th className="text-center px-1 py-1.5 text-orange-400">PTS</th>
              <th className="text-center px-1 py-1.5">REB</th>
              <th className="text-center px-1 py-1.5">AST</th>
              <th className="text-center px-1 py-1.5">STL</th>
              <th className="text-center px-1 py-1.5">BLK</th>
              <th className="text-center px-1 py-1.5">FG</th>
              <th className="text-center px-1 py-1.5">3P</th>
              <th className="text-center px-1 py-1.5">TOV</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {players.slice(0, 8).map(p => (
              <tr key={p.id} className="text-white/60">
                <td className="px-2 py-2 font-medium text-white whitespace-nowrap">{p.name}</td>
                <td className="text-center px-1 py-2 text-white/30">{p.minutes}</td>
                <td className="text-center px-1 py-2 text-orange-400 font-black">{p.pts}</td>
                <td className="text-center px-1 py-2">{p.reb}</td>
                <td className="text-center px-1 py-2">{p.ast}</td>
                <td className="text-center px-1 py-2">{p.stl}</td>
                <td className="text-center px-1 py-2">{p.blk}</td>
                <td className="text-center px-1 py-2 text-white/40">{p.fgm}/{p.fga}</td>
                <td className="text-center px-1 py-2 text-white/40">{p.three_pm}/{p.three_pa}</td>
                <td className="text-center px-1 py-2 text-red-400/70">{p.tov}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GameCard({ game, slug, season }: { game: Game; slug: string; season: string }) {
  const [expanded, setExpanded] = useState(false)
  const isUpcoming = game.home_score === null || game.away_score === null
  const homeWon = !isUpcoming && (game.home_score ?? 0) > (game.away_score ?? 0)
  const dateStr = new Date(game.game_date).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short'
  })

  const allPlayers = [
    ...game.home_players.map(p => ({ ...p, team: game.home_team.abbreviation })),
    ...game.away_players.map(p => ({ ...p, team: game.away_team.abbreviation })),
  ].sort((a, b) => b.pts - a.pts).slice(0, 3)

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => !isUpcoming && setExpanded(!expanded)}
        className="w-full p-4 text-left active:bg-white/5 transition-colors"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-white/20 text-xs">{dateStr}</span>
          {!isUpcoming && <span className="text-white/20 text-xs">{expanded ? '▲ Hide box score' : '▼ Box score'}</span>}
          {isUpcoming && <span className="text-white/30 text-xs">Upcoming</span>}
        </div>

        <div className="space-y-2">
          {[
            { team: game.home_team, score: game.home_score, won: homeWon },
            { team: game.away_team, score: game.away_score, won: !homeWon },
          ].map(({ team, score, won }) => (
            <div key={team.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {won && !isUpcoming && <span className="text-yellow-400 text-xs">👑</span>}
                <span className={`text-sm font-bold ${won ? 'text-white' : 'text-white/40'}`}>
                  {team.name}
                </span>
              </div>
              <span className={`text-xl font-black tabular-nums ${won ? 'text-orange-400' : 'text-white/25'}`}>
                {score ?? '—'}
              </span>
            </div>
          ))}
        </div>

        {!expanded && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {allPlayers.map(p => (
              <span key={p.id} className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
                {p.name.split(' ').pop()} <span className="text-orange-400 font-bold">{p.pts}</span>
                {p.reb >= 10 && <span className="text-blue-400 ml-1">{p.reb}r</span>}
                {p.ast >= 8 && <span className="text-green-400 ml-1">{p.ast}a</span>}
              </span>
            ))}
          </div>
        )}
        {!isUpcoming && <Link
          href={`/pro/${slug}/${season}/game/${game.id}`}
          className="block text-center text-xs text-orange-400/50 pb-1 mt-1 active:text-orange-400"
          onClick={e => e.stopPropagation()}
        >
          Full box score →
        </Link>}
      </button>

      {expanded && (
        <div className="border-t border-white/10 p-4 space-y-4">
          <BoxScoreTable
            players={game.home_players}
            teamName={game.home_team.name}
            score={game.home_score ?? 0}
            won={homeWon}
          />
          <div className="border-t border-white/10 pt-4">
            <BoxScoreTable
              players={game.away_players}
              teamName={game.away_team.name}
              score={game.away_score ?? 0}
              won={!homeWon}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function StandingsTable({ standings }: { standings: Standing[] }) {
  const groups = standings.reduce((acc, s) => {
    const conf = s.team.conference ?? 'League'
    if (!acc[conf]) acc[conf] = []
    acc[conf].push(s)
    return acc
  }, {} as Record<string, Standing[]>)

  return (
    <div className="flex flex-col gap-5">
      {Object.entries(groups).map(([conf, rows]) => (
        <div key={conf} className="card overflow-hidden">
          <div className="px-3 pt-3 pb-1 text-orange-400 text-xs font-bold uppercase tracking-wider">{conf}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/30 uppercase tracking-wider border-b border-white/10">
                  <th className="text-left px-3 py-2">Team</th>
                  <th className="text-center px-2 py-2">GP</th>
                  <th className="text-center px-2 py-2">W</th>
                  <th className="text-center px-2 py-2">L</th>
                  <th className="text-center px-2 py-2">PCT</th>
                  <th className="text-center px-2 py-2">PF</th>
                  <th className="text-center px-2 py-2">PA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map(s => (
                  <tr key={s.id} className={`text-white/70 ${s.team.is_dq ? 'opacity-40' : ''}`}>
                    <td className="px-3 py-2.5 font-semibold text-white whitespace-nowrap">
                      {s.team.name}
                      {s.team.is_dq && <span className="text-red-400 text-[10px] ml-1">DQ</span>}
                      {!s.team.is_dq && s.playoff_seed != null && (
                        <span className="text-green-400 text-[10px] ml-1.5 font-bold border border-green-400/40 rounded px-1 py-0.5">
                          Q{s.playoff_seed}
                        </span>
                      )}
                    </td>
                    <td className="text-center px-2 py-2.5">{s.games_played}</td>
                    <td className="text-center px-2 py-2.5">{s.wins}</td>
                    <td className="text-center px-2 py-2.5">{s.losses}</td>
                    <td className="text-center px-2 py-2.5 text-orange-400 font-black">
                      {s.win_pct !== null ? s.win_pct.toFixed(2) : '—'}
                    </td>
                    <td className="text-center px-2 py-2.5 text-white/40">{s.points_for}</td>
                    <td className="text-center px-2 py-2.5 text-white/40">{s.points_against}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ProSeasonPage() {
  const { slug, season: seasonSlug } = useParams() as { slug: string; season: string }
  const [following, setFollowing] = useState<boolean | null>(null)
  const [followLoading, setFollowLoading] = useState(false)

  async function toggleFollow(targetId: string, targetType: string) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('bz_profile_token') : null
    if (!token) { window.location.href = '/profile'; return }
    setFollowLoading(true)
    try {
      const res = await fetch('/api/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-profile-token': token },
        body: JSON.stringify({ target_id: targetId, target_type: targetType }),
      })
      const d = await res.json()
      setFollowing(d.following)
    } finally { setFollowLoading(false) }
  }

  const [data, setData] = useState<ProLeagueData | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [gamesLoading, setGamesLoading] = useState(false)
  const [tab, setTab] = useState<'leaders' | 'standings' | 'teams' | 'games' | 'clips'>('standings')
  const [statCat, setStatCat] = useState<StatCat>('pts')
  const [debugError, setDebugError] = useState<string | null>(null)
  const [seasonPickerOpen, setSeasonPickerOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    setData(null)
    setGames([])
    fetch(`/api/pro/${slug}/${seasonSlug}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`)
        return r.json()
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setDebugError(String(e?.message ?? e)); setLoading(false) })
  }, [slug, seasonSlug])

  useEffect(() => {
    if (tab === 'games' && games.length === 0) {
      setGamesLoading(true)
      fetch(`/api/pro/${slug}/${seasonSlug}/games`)
        .then(r => r.json())
        .then(d => { setGames(d.games ?? []); setGamesLoading(false) })
    }
  }, [tab, slug, seasonSlug])

  if (loading) return (
    <main className="min-h-dvh flex items-center justify-center">
      <div className="text-white/40 text-lg">Loading...</div>
    </main>
  )

  if (!data?.league || !data?.season) return (
    <main className="min-h-dvh flex items-center justify-center px-6">
      <div className="text-white/40 text-center">
        <div>League or season not found</div>
        {debugError && (
          <div className="text-red-400 text-xs mt-3 font-mono break-all">{debugError}</div>
        )}
      </div>
    </main>
  )

  const { league, season, seasons, players, teams, standings } = data
  const sorted = [...players].sort((a, b) => (b[statCat] ?? 0) - (a[statCat] ?? 0))

  return (
    <main className="min-h-dvh flex flex-col max-w-lg mx-auto pb-16">
      {/* Header */}
      <div className="pt-16 pb-6 px-5 border-b border-white/5">
        <p className="text-orange-400 text-xs uppercase tracking-wider font-semibold mb-1">🏀 Pro League</p>
        <h1 className="text-3xl font-black text-white">{league.name}</h1>

        {/* Season switcher */}
        <div className="relative mt-1 inline-block">
          <button
            onClick={() => setSeasonPickerOpen(!seasonPickerOpen)}
            className="text-white/40 text-sm flex items-center gap-1 active:text-white/70"
          >
            {season.label} {seasons.length > 1 && <span className="text-xs">▾</span>}
          </button>
          {seasonPickerOpen && seasons.length > 1 && (
            <div className="absolute z-10 mt-1 bg-[#15151f] border border-white/10 rounded-xl overflow-hidden min-w-[160px] shadow-xl">
              {seasons.map(s => (
                <Link
                  key={s.id}
                  href={`/pro/${slug}/${s.slug}`}
                  onClick={() => setSeasonPickerOpen(false)}
                  className={`block px-4 py-2.5 text-sm whitespace-nowrap
                    ${s.id === season.id ? 'text-orange-400 bg-orange-500/10 font-semibold' : 'text-white/60 active:bg-white/5'}`}
                >
                  {s.label}{s.is_current && <span className="text-[10px] text-white/30 ml-1.5">CURRENT</span>}
                </Link>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => toggleFollow(slug, 'league')}
          disabled={followLoading}
          className={`mt-3 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 block
            ${following ? 'bg-white/10 text-white/60 border border-white/20' : 'bg-orange-500 text-white'}
            ${followLoading ? 'opacity-50' : ''}`}
        >
          {followLoading ? '...' : following ? '✓ Following' : '+ Follow'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-5 pt-4 mb-4 overflow-x-auto">
        {(['standings', 'leaders', 'games', 'teams', 'clips'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap
              ${tab === t ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/50'}`}>
            {t === 'standings' ? '🏆 Standings' : t === 'leaders' ? '📊 Leaders' : t === 'games' ? '🏀 Games' : t === 'teams' ? '🏟 Teams' : '🎬 Clips'}
          </button>
        ))}
      </div>

      <div className="px-5">
        {/* Standings */}
        {tab === 'standings' && (
          standings.length > 0
            ? <StandingsTable standings={standings} />
            : <div className="text-white/30 text-sm text-center py-12">No standings yet for {season.label}.</div>
        )}

        {/* Leaders */}
        {tab === 'leaders' && (
          <>
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {STAT_CATS.map(cat => (
                <button key={cat} onClick={() => setStatCat(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all
                    ${statCat === cat ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/40'}`}>
                  {STAT_LABELS[cat]}
                </button>
              ))}
            </div>
            {sorted.length === 0 ? (
              <div className="text-white/30 text-sm text-center py-12">No player stats yet for {season.label}.</div>
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-white/30 uppercase tracking-wider border-b border-white/10">
                        <th className="text-left px-3 py-2 w-6">#</th>
                        <th className="text-left px-3 py-2">Player</th>
                        <th className="text-center px-2 py-2">TM</th>
                        <th className="text-center px-2 py-2">GP</th>
                        <th className="text-center px-2 py-2 text-orange-400">{statCat.toUpperCase()}</th>
                        <th className="text-center px-2 py-2">PTS</th>
                        <th className="text-center px-2 py-2">REB</th>
                        <th className="text-center px-2 py-2">AST</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {sorted.slice(0, 50).map((p, i) => (
                        <tr key={p.id} className={`text-white/70 ${i < 3 ? 'bg-orange-500/5' : ''}`}>
                          <td className="px-3 py-2.5 text-white/20 font-mono">{i + 1}</td>
                          <td className="px-3 py-2.5">
                            <Link href={`/pro/${slug}/${seasonSlug}/player/${p.player.id}`}
                              className="font-semibold text-white active:text-orange-400 whitespace-nowrap">
                              {p.player.name}
                            </Link>
                          </td>
                          <td className="text-center px-2 py-2.5 text-white/40">{p.team.abbreviation}</td>
                          <td className="text-center px-2 py-2.5 text-white/40">{p.games_played}</td>
                          <td className="text-center px-2 py-2.5 text-orange-400 font-black">{p[statCat]}</td>
                          <td className="text-center px-2 py-2.5">{p.pts}</td>
                          <td className="text-center px-2 py-2.5">{p.reb}</td>
                          <td className="text-center px-2 py-2.5">{p.ast}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Games */}
        {tab === 'games' && (
          <div className="flex flex-col gap-4">
            {gamesLoading && (
              <div className="text-white/30 text-sm text-center py-12">Loading games...</div>
            )}
            {!gamesLoading && games.length === 0 && (
              <div className="text-white/30 text-sm text-center py-12">
                No game stats yet for {season.label}.
              </div>
            )}
            {games.map((g) => (
              <GameCard key={g.id} game={g} slug={slug} season={seasonSlug} />
            ))}
          </div>
        )}

        {/* Teams */}
        {tab === 'teams' && (
          <div className="grid grid-cols-2 gap-3">
            {teams.map(team => (
              <Link key={team.id} href={`/pro/${slug}/${seasonSlug}/team/${team.id}`}>
                <div className={`card p-4 flex flex-col items-center gap-2 active:bg-white/5 text-center ${team.is_dq ? 'opacity-40' : ''}`}>
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl">
                    🏀
                  </div>
                  <p className="text-white text-xs font-bold leading-tight">{team.name}</p>
                  <p className="text-white/30 text-xs">{team.is_dq ? 'DQ' : team.abbreviation}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Clips */}
        {tab === 'clips' && (
          <div className="mb-5">
            <ClipsTab apiBase={`/api/pro/${slug}`} />
          </div>
        )}
      </div>
    </main>
  )
}
