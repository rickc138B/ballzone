'use client'

import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'

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
  const cardRef = useRef<HTMLDivElement>(null)
  const [sharing, setSharing] = useState(false)

  const homeWon = homeTeam.score > awayTeam.score
  const winner = homeWon ? homeTeam : awayTeam
  const loser = homeWon ? awayTeam : homeTeam

  const allPlayers = [...homePlayers, ...awayPlayers]
  const topScorer = allPlayers.sort((a, b) => b.pts - a.pts)[0]
  const topRebounder = [...allPlayers].sort((a, b) => b.reb - a.reb)[0]
  const topAssister = [...allPlayers].sort((a, b) => b.ast - a.ast)[0]

  async function handleShare() {
    if (!cardRef.current) return
    setSharing(true)
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0f0f1a',
        scale: 2,
        useCORS: true,
        logging: false,
      })

      if (navigator.share) {
        try {
          const blob = await new Promise<Blob>((res, rej) =>
            canvas.toBlob(b => b ? res(b) : rej(new Error('blob failed')), 'image/png')
          )
          const file = new File([blob], 'ballzone-result.png', { type: 'image/png' })
          await navigator.share({
            files: [file],
            title: `${winner.name} ${winner.score} - ${loser.score} ${loser.name}`,
            text: `🏀 Game result on Ballzone\nballzone-woad.vercel.app`,
          })
          setSharing(false)
          return
        } catch (shareErr) {
          console.log('Native share failed, trying download', shareErr)
        }
      }

      // Fallback — download
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = 'ballzone-result.png'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

    } catch (e) {
      console.error('Share failed', e)
    }
    setSharing(false)
  }

  return (
    <div className="w-full">
      {/* The card to capture */}
      <div
        ref={cardRef}
        className="w-full rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0f0f1a 100%)',
          fontFamily: 'Inter, sans-serif',
          padding: '24px',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ color: '#f97316', fontSize: '10px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>
            {leagueName ?? 'Ballzone'}{roundLabel ? ` · ${roundLabel}` : ''}
          </div>
          {playedAt && (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>
              {new Date(playedAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              {locationName ? ` · ${locationName}` : ''}
            </div>
          )}
        </div>

        {/* Score */}
        <div style={{ marginBottom: '20px' }}>
          {[
            { team: homeTeam, won: homeWon },
            { team: awayTeam, won: !homeWon }
          ].map(({ team, won }) => (
            <div key={team.name} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {won && <span style={{ fontSize: '14px' }}>👑</span>}
                <span style={{
                  color: won ? '#ffffff' : 'rgba(255,255,255,0.4)',
                  fontWeight: won ? 800 : 400,
                  fontSize: '18px',
                }}>
                  {team.name}
                </span>
              </div>
              <span style={{
                color: won ? '#f97316' : 'rgba(255,255,255,0.3)',
                fontWeight: 900,
                fontSize: '32px',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {team.score}
              </span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', marginBottom: '16px' }} />

        {/* Stat leaders */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {[
            { label: '🔥 Points', player: topScorer, stat: `${topScorer?.pts} PTS` },
            { label: '💪 Boards', player: topRebounder, stat: `${topRebounder?.reb} REB` },
            { label: '🎯 Assists', player: topAssister, stat: `${topAssister?.ast} AST` },
          ].map(({ label, player, stat }) => (
            <div key={label} style={{
              flex: 1,
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '12px',
              padding: '10px 8px',
              textAlign: 'center',
            }}>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', marginBottom: '4px' }}>{label}</div>
              <div style={{ color: '#f97316', fontWeight: 700, fontSize: '11px', marginBottom: '2px' }}>{stat}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '9px', lineHeight: 1.2 }}>
                {player?.display_name ?? '—'}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '16px' }}>⛹️</span>
            <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 900, fontSize: '14px' }}>Ballzone</span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px' }}>ballzone-woad.vercel.app</div>
        </div>
      </div>

      {/* Share button */}
      <button
        type="button"
        onClick={async (e) => { e.preventDefault(); e.stopPropagation(); await handleShare() }}
        disabled={sharing}
        className="w-full mt-3 py-3.5 rounded-2xl font-bold text-white text-sm
                   bg-orange-500 active:scale-95 transition-transform disabled:opacity-50
                   flex items-center justify-center gap-2"
      >
        {sharing ? 'Generating...' : '📤 Share Result'}
      </button>
    </div>
  )
}
