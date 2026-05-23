'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 text-center">
      <div className="text-6xl mb-4">⚠️</div>
      <h1 className="text-2xl font-black text-white mb-2">Something went wrong</h1>
      <p className="text-white/50 text-sm mb-8">
        {error.message ?? 'An unexpected error occurred.'}
      </p>
      <button onClick={reset} className="btn-primary max-w-xs">
        Try Again
      </button>
    </main>
  )
}
