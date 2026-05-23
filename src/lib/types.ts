// src/lib/types.ts

export type RunStatus = 'draft' | 'open' | 'active' | 'completed' | 'cancelled'
export type AttendanceStatus = 'in' | 'out' | 'late'
export type GameStatus = 'pre_game' | 'live' | 'contested' | 'complete'
export type SessionStatus = 'lobby' | 'active' | 'ended'
export type TeamStatus = 'waiting' | 'on_court' | 'eliminated'

export interface Run {
  id: string
  title: string
  run_date: string
  run_time: string
  location_name: string
  location_lat: number | null
  location_lng: number | null
  players_needed: number
  notes: string | null
  status: RunStatus
  organizer_id: string | null
  share_token: string
  created_at: string
}

export interface Organizer {
  id: string
  phone: string | null
  display_name: string | null
  session_token_hash: string | null
  created_at: string
}

export interface Participant {
  id: string
  display_name: string | null
  fingerprint: string | null
  phone: string | null
  created_at: string
}

export interface Attendance {
  id: string
  run_id: string
  participant_id: string
  status: AttendanceStatus
  responded_at: string
  updated_at: string
  participant?: Participant
}

export interface CourtConfig {
  format: 'winner_stays' | 'rotating' | 'round_robin'
  scoring: '1s_2s' | '2s_3s'
  target_score: number
  win_condition: 'straight_up' | 'win_by_2'
  possession_rule: 'make_it_take_it' | 'losers_out'
  max_consecutive_wins: number | null
}

export interface Session {
  id: string
  run_id: string
  organizer_id: string | null
  court_config: CourtConfig
  status: SessionStatus
  created_at: string
}

export interface RunTeam {
  id: string
  session_id: string
  name: string | null
  color: string
  status: TeamStatus
  queue_position: number | null
  consecutive_wins: number
  created_at: string
}

export interface Game {
  id: string
  session_id: string
  sequence_number: number
  team_a_id: string
  team_b_id: string
  score_a: number
  score_b: number
  possession: 'a' | 'b' | null
  status: GameStatus
  started_at: string | null
  ended_at: string | null
  winner_team_id: string | null
  created_at: string
  team_a?: RunTeam
  team_b?: RunTeam
}

export interface ScoreEvent {
  id: string
  game_id: string
  team_id: string
  points: 1 | 2 | 3
  scored_by_player_id: string | null
  scorer_name: string | null
  timestamp: string
  voided: boolean
  voided_at: string | null
}

export interface RunWithAttendance extends Run {
  attendance: (Attendance & { participant: Participant })[]
  counts: {
    in: number
    out: number
    late: number
  }
}

// API response shapes
export interface CreateRunResponse {
  run_id: string
  url: string
  share_token: string
  share_text: string
}

export interface RespondResponse {
  participant_id: string
  status: AttendanceStatus
}
