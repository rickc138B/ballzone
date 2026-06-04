import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const homeTeam = searchParams.get('ht') ?? 'Home'
  const awayTeam = searchParams.get('at') ?? 'Away'
  const homeScore = searchParams.get('hs') ?? '0'
  const awayScore = searchParams.get('as') ?? '0'
  const league = searchParams.get('lg') ?? 'Ballzone'
  const round = searchParams.get('rd') ?? ''
  const topScorer = searchParams.get('ts') ?? ''
  const topScorerPts = searchParams.get('tp') ?? ''
  const topRebounder = searchParams.get('tr') ?? ''
  const topRebounderReb = searchParams.get('trr') ?? ''
  const topAssister = searchParams.get('ta') ?? ''
  const topAssisterAst = searchParams.get('taa') ?? ''
  const date = searchParams.get('dt') ?? ''

  const homeWon = parseInt(homeScore) > parseInt(awayScore)

  return new ImageResponse(
    (
      <div
        style={{
          width: '1080px',
          height: '1080px',
          background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0f0f1a 100%)',
          display: 'flex',
          flexDirection: 'column',
          padding: '80px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '60px', width: '100%' }}>
          <div style={{ color: '#f97316', fontSize: '28px', fontWeight: 700, letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '12px' }}>
            {league}{round ? ` · ${round}` : ''}
          </div>
          {date && (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '24px' }}>{date}</div>
          )}
        </div>

        {/* Scores */}
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '60px', gap: '24px', width: '100%' }}>
          {[
            { name: homeTeam, score: homeScore, won: homeWon },
            { name: awayTeam, score: awayScore, won: !homeWon },
          ].map(({ name, score, won }) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: 'auto' }}>
                {won && <span style={{ fontSize: '40px' }}>👑</span>}
                <span style={{
                  color: won ? '#ffffff' : 'rgba(255,255,255,0.35)',
                  fontWeight: 900,
                  fontSize: '64px',
                }}>
                  {name}
                </span>
              </div>
              <span style={{
                color: won ? '#f97316' : 'rgba(255,255,255,0.25)',
                fontWeight: 900,
                fontSize: '100px',
              }}>
                {score}
              </span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: '2px', background: 'rgba(255,255,255,0.08)', marginBottom: '60px' }} />

        {/* Stat leaders */}
        <div style={{ display: 'flex', gap: '24px', marginBottom: '80px', width: '100%' }}>
          {[
            { label: 'Points', player: topScorer, stat: `${topScorerPts} PTS`, emoji: '🔥' },
            { label: 'Boards', player: topRebounder, stat: `${topRebounderReb} REB`, emoji: '💪' },
            { label: 'Assists', player: topAssister, stat: `${topAssisterAst} AST`, emoji: '🎯' },
          ].map(({ label, player, stat, emoji }) => (
            <div key={label} style={{
              flex: 1,
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '24px',
              padding: '32px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '22px', marginBottom: '12px' }}>{emoji} {label}</div>
              <div style={{ color: '#f97316', fontWeight: 800, fontSize: '36px', marginBottom: '8px' }}>{stat}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '24px' }}>{player}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: 'auto' }}>
            <span style={{ fontSize: '48px' }}>⛹️</span>
            <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '48px' }}>Ballzone</span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '24px' }}>ballzone-woad.vercel.app</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 }
  )
}
