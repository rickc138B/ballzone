import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 text-center">
      <div className="mb-8">
        <div className="text-6xl mb-4">🏀</div>
        <h1 className="text-4xl font-black text-white mb-2">Ballzone</h1>
        <p className="text-white/60 text-lg">Pickup basketball, organized.</p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <Link href="/new" className="btn-primary block text-center py-4">
          Create a Run
        </Link>
        <p className="text-white/40 text-sm">
          Got a link? Tap it to respond.
        </p>
        <Link href="/history" className="text-white/30 text-sm underline underline-offset-2 block text-center pt-2">
          View your runs →
        </Link>
      </div>
    </main>
  )
}
