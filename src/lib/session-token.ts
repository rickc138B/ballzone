// Organizer identity — stored in localStorage, hashed before sending to server

const STORAGE_KEY = 'bz_organizer_token'
const RUNS_KEY = 'bz_organizer_runs'

export function getOrCreateSessionToken(): string {
  if (typeof window === 'undefined') return ''
  let token = localStorage.getItem(STORAGE_KEY)
  if (!token) {
    const array = new Uint8Array(24)
    crypto.getRandomValues(array)
    token = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
    localStorage.setItem(STORAGE_KEY, token)
  }
  return token
}

export async function hashToken(token: string): Promise<string> {
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token)
  )
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// Track runs this organizer created (for history & pre-fill)
export interface OrganizerRunRecord {
  run_id: string
  share_token: string
  title: string
  location_name: string
  run_time: string
  run_date: string
  created_at: string
}

export function saveOrganizerRun(record: OrganizerRunRecord) {
  if (typeof window === 'undefined') return
  const existing = getOrganizerRuns()
  const updated = [record, ...existing].slice(0, 20) // keep last 20
  localStorage.setItem(RUNS_KEY, JSON.stringify(updated))
}

export function getOrganizerRuns(): OrganizerRunRecord[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(RUNS_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function getLastRun(): OrganizerRunRecord | null {
  const runs = getOrganizerRuns()
  return runs[0] ?? null
}

// Track participant name
export function getParticipantName(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('bz_participant_name') ?? ''
}

export function saveParticipantName(name: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem('bz_participant_name', name)
}

// Track participant ID (server-assigned, persisted locally)
export function getParticipantId(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('bz_participant_id') ?? ''
}

export function saveParticipantId(id: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem('bz_participant_id', id)
}

// Check if this organizer owns a specific run
export function isOrganizerOfRun(runId: string): boolean {
  return getOrganizerRuns().some(r => r.run_id === runId)
}

export function getShareToken(runId: string): string | null {
  return getOrganizerRuns().find(r => r.run_id === runId)?.share_token ?? null
}

// Profile session token (set after OTP verify)
export function getProfileToken(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('bz_profile_token') ?? ''
}

export function saveProfileToken(token: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem('bz_profile_token', token)
}

export function getProfileId(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('bz_profile_id') ?? ''
}

export function saveProfileId(id: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem('bz_profile_id', id)
}

export function clearProfile() {
  if (typeof window === 'undefined') return
  localStorage.removeItem('bz_profile_token')
  localStorage.removeItem('bz_profile_id')
}

export function isClaimed(): boolean {
  return !!getProfileToken()
}
