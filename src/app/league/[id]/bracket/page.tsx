'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type Team = { id: string; name: string }
type BracketGame = {
  id: string
  round_label: string | null
  bracket_round: number
  bracket_slot: number
  played_at: string | null
  home_score: number | null
  away_score: number | null
  status: string | null
  home_team: Team | null
  away_team: Team | null
}

const ROUND_NAMES: Record<number, string> = {
  1: 'Quarter Finals',
  2: 'Semi Finals',
  3: 'Final',
}

export default function BracketPage() {
  const { id: leagueId } = useParams() as { id: string }
  const [rounds, setRounds] = useState<Record<number, BracketGame[]>>({})
  const [roundLabels, setRoundLabels] = useState<Record<number, string>>({})
  const [leagueTitle, setLeagueTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/leagues/${leagueId}/bracket`)
      .then(r => r.json())
      .then(d => {
        setRounds(d.rounds ?? {})
        setRoundLabels(d.roundLabels ?? {})
        setLoading(false)
      })
    fetch(`/api/leagues/${leagueId}`)
      .then(r => r.json())
      .then(d => setLeagueTitle(d.league?.title ?? ''))
  }, [leagueId])

  const roundNums = Object.keys(rounds).map(Number).sort((a, b) => a - b)
  const maxRound = Math.max(...roundNums, 0)

  // Height per game card
  const CARD_H = 88
  const CARD_GAP = 24
  const ROUND_W = 200
  const ROUND_GAP = 60

  function getCardTop(round: number, slot: number, totalRounds: number): number {
    const gamesInRound = rounds[round]?.length ?? 1
    const totalH = gamesInRound * CARD_H + (gamesInRound - 1) * CARD_GAP
    const maxGames = rounds[roundNums[0]]?.length ?? 1
    const maxH = maxGames * CARD_H + (maxGames - 1) * CARD_GAP
    const topOffset = (maxH - totalH) / 2
    return topOffset + (slot - 1) * (CARD_H + CARD_GAP)
  }

  function totalHeight(): number {
    const maxGames = rounds[roundNums[0]]?.length ?? 1
    return Math.max(maxGames * CARD_H + (maxGames - 1) * CARD_GAP + 80, 400)
  }

  function totalWidth(): number {
    return roundNums.length * (ROUND_W + ROUND_GAP) + 40
  }

  // SVG connector lines between rounds
  function renderConnectors() {
    const lines: JSX.Element[] = []
    for (let ri = 0; ri < roundNums.length - 1; ri++) {
      const fromRound = roundNums[ri]
      const toRound = roundNums[ri + 1]
      const toGames = rounds[toRound] ?? []
      const fromGames = rounds[fromRound] ?? []

      for (const toGame of toGames) {
        // Find the two fromGames that feed into this toGame (slots 2n-1 and 2n)
        const slot = toGame.bracket_slot
        const feedSlot1 = (slot - 1) * 2 + 1
        const feedSlot2 = (slot - 1) * 2 + 2
        const from1 = fromGames.find(g => g.bracket_slot === feedSlot1)
        const from2 = fromGames.find(g => g.bracket_slot === feedSlot2)

        const toX = ri * (ROUND_W + ROUND_GAP) + ROUND_W + 20
        const toY = getCardTop(toRound, slot, roundNums.length) + CARD_H / 2 + 40

        if (from1) {
          const fromX = ri * (ROUND_W + ROUND_GAP) + ROUND_W + 20
          const fromY = getCardTop(fromRound, feedSlot1, roundNums.length) + CARD_H / 2 + 40
          const midX = fromX + ROUND_GAP / 2
          lines.push(
            <path key={`${fromRound}-${feedSlot1}-${toRound}-${slot}`}
              d={`M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX + ROUND_GAP}`}
              fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
          )
        }
        if (from2) {
          const fromX = ri * (ROUND_W + ROUND_GAP) + ROUND_W + 20
          const fromY = getCardTop(fromRound, feedSlot2, roundNums.length) + CARD_H / 2 + 40
          const midX = fromX + ROUND_GAP / 2
          lines.push(
            <path key={`${fromRound}-${feedSlot2}-${toRound}-${slot}`}
              d={`M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX + ROUND_GAP}`}
              fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
          )
        }
      }
    }
    return lines
  }

  return (
    <main className="min-h-dvh flex flex-col p-5 max-w-full pb-10">
      <div className="pt-4 mb-6 max-w-lg mx-auto w-full">
        <Link href={`/league/${leagueId}`} className="text-white/40 text-sm mb-4 block">← {leagueTitle || 'League'}</Link>
        <p className="text-orange-400 text-xs uppercase tracking-wider font-semibold mb-1">🏆 Tournament</p>
        <h1 className="text-2xl font-black text-white">Bracket</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-white/40">Loading...</div>
        </div>
      ) : roundNums.length === 0 ? (
        <div className="text-center py-20 max-w-lg mx-auto">
          <div className="text-4xl mb-3">🏆</div>
          <p className="text-white font-bold mb-1">No bracket games yet</p>
          <p className="text-white/40 text-sm">Schedule games with bracket positions from the admin panel</p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div ref={containerRef} className="relative" style={{ width: totalWidth(), height: totalHeight() }}>

            {/* SVG connector lines */}
            <svg className="absolute inset-0 pointer-events-none"
              width={totalWidth()} height={totalHeight()}>
              {renderConnectors()}
            </svg>

            {/* Round headers + game cards */}
            {roundNums.map((roundNum, ri) => {
              const label = roundLabels[roundNum] ?? ROUND_NAMES[roundNum] ?? `Round ${roundNum}`
              const gamesInRound = rounds[roundNum] ?? []
              const x = ri * (ROUND_W + ROUND_GAP)

              return (
                <div key={roundNum} className="absolute" style={{ left: x, top: 0, width: ROUND_W }}>
                  {/* Round label */}
                  <div className="text-center mb-3">
                    <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full
                      ${roundNum === maxRound ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'text-white/30'}`}>
                      {label}
                    </span>
                  </div>

                  {/* Game cards */}
                  {gamesInRound.map(g => {
                    const top = getCardTop(roundNum, g.bracket_slot, roundNums.length)
                    const isComplete = g.status === 'complete'
                    const isLive = g.status === 'live'
                    const homeWon = isComplete && (g.home_score ?? 0) > (g.away_score ?? 0)
                    const awayWon = isComplete && (g.away_score ?? 0) > (g.home_score ?? 0)
                    const isFinal = roundNum === maxRound

                    return (
                      <Link key={g.id} href={`/league/${leagueId}/game/${g.id}`}>
                        <div className={`absolute w-full rounded-2xl border overflow-hidden active:opacity-70 transition-opacity
                          ${isFinal ? 'border-orange-500/40 bg-orange-500/5' : 'border-white/10 bg-white/5'}
                          ${isLive ? 'border-green-500/40 bg-green-500/5' : ''}`}
                          style={{ top, height: CARD_H }}>

                          {isLive && (
                            <div className="flex items-center gap-1 px-3 pt-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                              <span className="text-green-400 text-xs font-bold">LIVE</span>
                            </div>
                          )}

                          <div className="px-3 py-2 space-y-1.5">
                            {[
                              { team: g.home_team, score: g.home_score, won: homeWon },
                              { team: g.away_team, score: g.away_score, won: awayWon },
                            ].map(({ team, score, won }) => (
                              <div key={team?.id ?? Math.random()} className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {won && <span className="text-yellow-400 text-xs flex-shrink-0">👑</span>}
                                  <span className={`text-xs font-semibold truncate ${won ? 'text-white' : 'text-white/50'}`}>
                                    {team?.name ?? 'TBD'}
                                  </span>
                                </div>
                                <span className={`text-sm font-black tabular-nums ml-2 flex-shrink-0
                                  ${won ? (isFinal ? 'text-orange-400' : 'text-green-400') : 'text-white/30'}`}>
                                  {score ?? '—'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </main>
  )
}
