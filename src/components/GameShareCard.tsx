'use client'

import { useState } from 'react'

type PlayerStat = {
  display_name: string
  pts: number; reb: number; ast: number
}

type Props = {
  leagueName?: string
  roundLabel?: string | null
  homeTeam: { name: string; score: number }
  awayTeam: { name: string; score: number }
  homePlayers: PlayerStat[]
  awayPlayers: PlayerStat[]
  playedAt?: string | null
  locationName?: string | null
}

export default function GameShareCard({
  leagueName, roundLabel, homeTeam, awayTeam,
  homePlayers, awayPlayers, playedAt, locationName
}: Props) {
  const [sharing, setSharing] = useState(false)

  const homeWon = homeTeam.score > awayTeam.score
  const winner = homeWon ? homeTeam : awayTeam
  const loser = homeWon ? awayTeam : homeTeam

  const allPlayers = [...homePlayers, ...awayPlayers]
  const topScorer = [...allPlayers].sort((a, b) => b.pts - a.pts)[0]
  const topRebounder = [...allPlayers].sort((a, b) => b.reb - a.reb)[0]
  const topAssister = [...allPlayers].sort((a, b) => b.ast - a.ast)[0]

  function buildCardUrl() {
    const base = '/api/game-card'
    const p = new URLSearchParams({
      ht: homeTeam.name,
      at: awayTeam.name,
      hs: String(homeTeam.score),
      as: String(awayTeam.score),
      lg: leagueName ?? 'Ballzone',
      rd: roundLabel ?? '',
      ts: topScorer?.display_name ?? '',
      tp: String(topScorer?.pts ?? ''),
      tr: topRebounder?.display_name ?? '',
      trr: String(topRebounder?.reb ?? ''),
      ta: topAssister?.display_name ?? '',
      taa: String(topAssister?.ast ?? ''),
      dt: playedAt ? new Date(playedAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : '',
    })
    return \`${base}?${p.toString()}\`
  }

  async function handleShare() {
    setSharing(true)
    try {
      const cardUrl = buildCardUrl()
      const res = await fetch(cardUrl)
      const blob = await res.blob()
      const file = new File([blob], 'ballzone-result.png', { type: 'image/png' })

      if (navigator.share) {
        try {
          await navigator.share({
            files: [file],
            title: \`${winner.name} ${winner.score} - ${loser.score} ${loser.name}\`,
            text: '🏀 Game result on Ballzone\nballzone-woad.vercel.app',
          })
          setSharing(false)
          return
        } catch (e) {
          console.log('Share sheet failed, downloading', e)
        }
      }

      // Fallback — open image in new tab
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch (e) {
      console.error('Share failed', e)
    }
    setSharing(false)
  }

  const cardUrl = buildCardUrl()

  return (
    <div className="w-full">
      {/* Preview of the card */}
      <div className="w-full rounded-2xl overflow-hidden mb-3 bg-[#0f0f1a]">
        <img
          src={cardUrl}
          alt="Game result card"
          className="w-full"
          style={{ aspectRatio: '1' }}
        />
      </div>

      {/* Share button */}
      <button
        type="button"
        onClick={handleShare}
        disabled={sharing}
        className="w-full py-3.5 rounded-2xl font-bold text-white text-sm
                   bg-orange-500 active:scale-95 transition-transform disabled:opacity-50
                   flex items-center justify-center gap-2"
      >
        {sharing ? 'Generating...' : '📤 Share Result'}
      </button>
    </div>
  )
}
