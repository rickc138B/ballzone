import { createServiceClient } from '@/lib/supabase-server'

export type AnalyticsEvent =
  | 'run_created'
  | 'attendance_responded'
  | 'game_started'
  | 'game_completed'

export async function track(
  event: AnalyticsEvent,
  payload?: { run_id?: string; meta?: Record<string, unknown> }
) {
  try {
    const supabase = createServiceClient()
    await supabase.from('analytics_events').insert({
      event,
      run_id: payload?.run_id ?? null,
      meta: payload?.meta ?? null,
    })
  } catch {
    // fire-and-forget — never throws
  }
}
