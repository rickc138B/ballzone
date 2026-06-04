'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com'
    console.log('[PostHog] init with key:', key?.slice(0, 10), 'host:', host)
    if (!key) {
      console.error('[PostHog] missing key')
      return
    }
    posthog.init(key, {
      api_host: host,
      person_profiles: 'identified_only',
      capture_pageview: false,
      loaded: (ph) => {
        console.log('[PostHog] loaded, distinct_id:', ph.get_distinct_id())
      },
    })
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
