import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 text-center">
      <div className="text-6xl mb-4">🏀</div>
      <h1 className="text-2xl font-black text-white mb-2">Nothing here</h1>
      <p className="text-white/50 text-sm mb-8">
        This run doesn&apos;t exist or the link has expired.
      </p>
      <Link href="/" className="btn-primary max-w-xs block">
        Create a New Run
      </Link>
    </main>
  )
}
