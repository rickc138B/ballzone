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
      <div style={{ display: 'flex', flexDirection: 'column', width: '1080px', height: '1080px', background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0f0f1a 100%)', padding: '80px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '60px' }}>
          <div style={{ display: 'flex', color: '#f97316', fontSize: '28px', fontWeight: 700, letterSpacing: '4px', marginBottom: '12px' }}>
            {league}{round ? ` · ${round}` : ''}
          </div>
          <div style={{ display: 'flex', color: 'rgba(255,255,255,0.3)', fontSize: '24px' }}>
            {date}
          </div>
        </div>

        {/* Home team row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', fontSize: '40px' }}>{homeWon ? '👑' : ' '}</div>
            <div style={{ display: 'flex', color: homeWon ? '#ffffff' : 'rgba(255,255,255,0.35)', fontWeight: 900, fontSize: '60px' }}>{homeTeam}</div>
          </div>
          <div style={{ display: 'flex', color: homeWon ? '#f97316' : 'rgba(255,255,255,0.25)', fontWeight: 900, fontSize: '100px' }}>{homeScore}</div>
        </div>

        {/* Away team row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', fontSize: '40px' }}>{!homeWon ? '👑' : ' '}</div>
            <div style={{ display: 'flex', color: !homeWon ? '#ffffff' : 'rgba(255,255,255,0.35)', fontWeight: 900, fontSize: '60px' }}>{awayTeam}</div>
          </div>
          <div style={{ display: 'flex', color: !homeWon ? '#f97316' : 'rgba(255,255,255,0.25)', fontWeight: 900, fontSize: '100px' }}>{awayScore}</div>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', width: '100%', height: '2px', background: 'rgba(255,255,255,0.08)', marginBottom: '60px' }} />

        {/* Stat leaders */}
        <div style={{ display: 'flex', gap: '24px', width: '100%', marginBottom: '80px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: '24px', padding: '32px 24px' }}>
            <div style={{ display: 'flex', color: 'rgba(255,255,255,0.3)', fontSize: '22px', marginBottom: '12px' }}>🔥 Points</div>
            <div style={{ display: 'flex', color: '#f97316', fontWeight: 800, fontSize: '36px', marginBottom: '8px' }}>{topScorerPts} PTS</div>
            <div style={{ display: 'flex', color: 'rgba(255,255,255,0.6)', fontSize: '24px' }}>{topScorer}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: '24px', padding: '32px 24px' }}>
            <div style={{ display: 'flex', color: 'rgba(255,255,255,0.3)', fontSize: '22px', marginBottom: '12px' }}>💪 Boards</div>
            <div style={{ display: 'flex', color: '#f97316', fontWeight: 800, fontSize: '36px', marginBottom: '8px' }}>{topRebounderReb} REB</div>
            <div style={{ display: 'flex', color: 'rgba(255,255,255,0.6)', fontSize: '24px' }}>{topRebounder}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: '24px', padding: '32px 24px' }}>
            <div style={{ display: 'flex', color: 'rgba(255,255,255,0.3)', fontSize: '22px', marginBottom: '12px' }}>🎯 Assists</div>
            <div style={{ display: 'flex', color: '#f97316', fontWeight: 800, fontSize: '36px', marginBottom: '8px' }}>{topAssisterAst} AST</div>
            <div style={{ display: 'flex', color: 'rgba(255,255,255,0.6)', fontSize: '24px' }}>{topAssister}</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', fontSize: '48px' }}>⛹️</div>
            <div style={{ display: 'flex', color: '#ffffff', fontWeight: 900, fontSize: '48px' }}>Ballzone</div>
          </div>
          <div style={{ display: 'flex', color: 'rgba(255,255,255,0.2)', fontSize: '24px' }}>ballzone-woad.vercel.app</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 }
  )
}
