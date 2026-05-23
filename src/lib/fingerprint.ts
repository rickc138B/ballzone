export async function getFingerprint(): Promise<string> {
  if (typeof window === 'undefined') return 'server'

  const components = [
    navigator.userAgent,
    `${screen.width}x${screen.height}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
    String(new Date().getTimezoneOffset()),
  ]

  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillText('ballzone', 2, 2)
      components.push(canvas.toDataURL())
    }
  } catch {
    // canvas blocked — skip
  }

  const raw = components.join('|')
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(raw)
  )
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}
