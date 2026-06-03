import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  const { gameId } = await params
  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('game_commentary')
    .select('*')
    .eq('game_id', gameId)
    .single()

  if (existing) {
    return NextResponse.json(existing)
  }

  return NextResponse.json({ body: null })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  const { gameId } = await params
  const supabase = createServiceClient()

  // Return cached if exists
  const { data: existing } = await supabase
    .from('game_commentary')
    .select('*')
    .eq('game_id', gameId)
    .single()

  if (existing) {
    return NextResponse.json(existing)
  }

  // Fetch game
  const { data: game } = await supabase
    .from('games')
    .select('*, team_a:run_teams!games_team_a_id_fkey(*), team_b:run_teams!games_team_b_id_fkey(*)')
    .eq('id', gameId)
    .single()

  if (!game || game.status !== 'complete') {
    return NextResponse.json({ error: 'Game not complete' }, { status: 400 })
  }

  // Fetch score events
  const { data: events } = await supabase
    .from('score_events')
    .select('*, player:participants!score_events_scored_by_player_id_fkey(display_name)')
    .eq('game_id', gameId)
    .eq('voided', false)
    .order('timestamp', { ascending: true })

  // Fetch session for court config
  const { data: session } = await supabase
    .from('sessions')
    .select('court_config')
    .eq('id', game.session_id)
    .single()

  const teamA = game.team_a?.name ?? 'Team A'
  const teamB = game.team_b?.name ?? 'Team B'
  const winner = game.winner_team_id === game.team_a_id ? teamA : teamB
  const startedAt = game.started_at ? new Date(game.started_at).getTime() : null

  const timeline = (events ?? []).map(e => {
    const isA = e.team_id === game.team_a_id
    const scorer = e.scorer_name
      ?? (e.player as any)?.display_name
      ?? null
    const elapsed = startedAt
      ? Math.max(0, (new Date(e.timestamp).getTime() - startedAt) / 1000)
      : null
    return `[${elapsed !== null ? formatElapsed(elapsed) : '--:--'}] ${isA ? teamA : teamB} +${e.points}${scorer ? ` (${scorer})` : ''}`
  }).join('\n')

  const scoring = session?.court_config?.scoring ?? '2s_3s'
  const targetScore = session?.court_config?.target_score ?? 21
  const durationMins = game.started_at && game.ended_at
    ? Math.round((new Date(game.ended_at).getTime() - new Date(game.started_at).getTime()) / 60000)
    : null

  const prompt = `You are a sports broadcaster calling a pickup basketball game after the fact.

Game: ${teamA} vs ${teamB} — Game ${game.sequence_number}
Final: ${teamA} ${game.score_a} — ${teamB} ${game.score_b} (${winner} wins)${durationMins ? `\nDuration: ${durationMins} minutes` : ''}
Scoring: ${scoring === '2s_3s' ? '2-pointers and 3-pointers' : '1s and 2s'}, first to ${targetScore}

Play-by-play timeline:
${timeline || '(no scorer data recorded)'}

Write a 150–200 word post-game commentary narrative. Call it like a radio broadcaster — with rhythm, drama, and character. Reference specific moments from the timeline by time and scorer name where available. Note momentum swings (3 or more consecutive points by one team). End with the final score and a one-sentence verdict on the game.

Write only the commentary. No title, no header, no explanation.`

  // Call OpenRouter
  const anthropicRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'openrouter/auto',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!anthropicRes.ok) {
    const err = await anthropicRes.text()
    console.error('Anthropic error:', err)
    return NextResponse.json({ error: 'Commentary generation failed' }, { status: 500 })
  }

  const aiData = await anthropicRes.json()
  const body = aiData.choices?.[0]?.message?.content?.trim()

  if (!body) {
    return NextResponse.json({ error: 'Empty response from model' }, { status: 500 })
  }

  // Cache it
  const { data: saved } = await supabase
    .from('game_commentary')
    .insert({ game_id: gameId, body, model: 'openrouter/auto' })
    .select()
    .single()

  return NextResponse.json(saved)
}
