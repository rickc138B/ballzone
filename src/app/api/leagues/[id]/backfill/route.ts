import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leagueId } = await params
    const { game, home_team, away_team } = await req.json()
    const supabase = createServiceClient()

    let { data: homeTeam } = await supabase
      .from('league_teams').select('id')
      .eq('league_id', leagueId).eq('name', home_team.name).single()
    if (!homeTeam) {
      const { data } = await supabase.from('league_teams')
        .insert({ league_id: leagueId, name: home_team.name }).select('id').single()
      homeTeam = data
    }

    let { data: awayTeam } = await supabase
      .from('league_teams').select('id')
      .eq('league_id', leagueId).eq('name', away_team.name).single()
    if (!awayTeam) {
      const { data } = await supabase.from('league_teams')
        .insert({ league_id: leagueId, name: away_team.name }).select('id').single()
      awayTeam = data
    }

    if (!homeTeam || !awayTeam)
      return NextResponse.json({ error: 'Failed to upsert teams' }, { status: 500 })

    const homeScore = home_team.players.reduce((s: number, p: any) => s + (p.pts ?? 0), 0)
    const awayScore = away_team.players.reduce((s: number, p: any) => s + (p.pts ?? 0), 0)

    const { data: existing } = await supabase
      .from('league_games').select('sequence_number')
      .eq('league_id', leagueId).order('sequence_number', { ascending: false }).limit(1)
    const nextSeq = (existing?.[0]?.sequence_number ?? 0) + 1

    const { data: leagueGame, error: gameError } = await supabase
      .from('league_games')
      .insert({
        league_id: leagueId,
        home_team_id: homeTeam.id,
        away_team_id: awayTeam.id,
        home_score: homeScore,
        away_score: awayScore,
        played_at: game.played_at ? new Date(game.played_at).toISOString() : new Date().toISOString(),
        round_label: game.round_label ?? null,
        location_name: game.location_name ?? null,
        sequence_number: nextSeq,
        status: 'complete',
      })
      .select('id').single()

    if (gameError || !leagueGame)
      return NextResponse.json({ error: gameError?.message ?? 'Failed to create game' }, { status: 500 })

    async function insertTeamStats(teamData: any, teamId: string, gameId: string) {
      for (const p of teamData.players) {
        let { data: player } = await supabase
          .from('league_players').select('id')
          .eq('league_team_id', teamId).eq('display_name', p.name).single()
        if (!player) {
          const { data } = await supabase.from('league_players')
            .insert({ league_team_id: teamId, display_name: p.name }).select('id').single()
          player = data
        }
        if (!player) continue
        await supabase.from('player_game_stats').insert({
          league_game_id: gameId,
          league_player_id: player.id,
          league_team_id: teamId,
          pts: p.pts ?? 0, reb: p.reb ?? 0, ast: p.ast ?? 0,
          blk: p.blk ?? 0, stl: p.stl ?? 0, tov: p.tov ?? 0,
          fga: p.fga ?? 0, fgm: p.fgm ?? 0,
          three_pa: p.three_pa ?? 0, three_pm: p.three_pm ?? 0,
          fta: p.fta ?? 0, ftm: p.ftm ?? 0,
        })
      }
    }

    await insertTeamStats(home_team, homeTeam.id, leagueGame.id)
    await insertTeamStats(away_team, awayTeam.id, leagueGame.id)

    return NextResponse.json({ game_id: leagueGame.id, sequence_number: nextSeq, home_score: homeScore, away_score: awayScore })
  } catch (err) {
    console.error('League backfill error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
