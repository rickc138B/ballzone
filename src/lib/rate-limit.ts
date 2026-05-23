import { createServiceClient } from '@/lib/supabase-server'

interface RateLimitResult {
  allowed: boolean
  remaining: number
}

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMinutes: number
): Promise<RateLimitResult> {
  try {
    const supabase = createServiceClient()
    const windowMs = windowMinutes * 60 * 1000

    const { data: existing } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('key', key)
      .single()

    if (!existing) {
      await supabase.from('rate_limits').insert({ key, count: 1 })
      return { allowed: true, remaining: maxRequests - 1 }
    }

    const windowAge = Date.now() - new Date(existing.window_start).getTime()

    if (windowAge > windowMs) {
      // Window expired — reset
      await supabase
        .from('rate_limits')
        .update({ count: 1, window_start: new Date().toISOString() })
        .eq('key', key)
      return { allowed: true, remaining: maxRequests - 1 }
    }

    if (existing.count >= maxRequests) {
      return { allowed: false, remaining: 0 }
    }

    await supabase
      .from('rate_limits')
      .update({ count: existing.count + 1 })
      .eq('key', key)

    return { allowed: true, remaining: maxRequests - existing.count - 1 }
  } catch {
    // Fail open — don't block on rate limit errors
    return { allowed: true, remaining: maxRequests }
  }
}
