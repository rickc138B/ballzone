import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase-server'
import { formatRunDate, formatRunTime } from '@/lib/utils'

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: run } = await supabase
    .from('runs')
    .select('*')
    .eq('id', id)
    .single()

  if (!run) {
    return {
      title: 'Run not found — Ballzone',
    }
  }

  const { data: attendance } = await supabase
    .from('attendance')
    .select('status')
    .eq('run_id', id)

  const inCount = attendance?.filter(a => a.status === 'in').length ?? 0
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ballzone.app'
  const ogImageUrl = `${appUrl}/api/og/run?id=${id}`

  const title = `🏀 ${run.title} — ${formatRunDate(run.run_date)} ${formatRunTime(run.run_time)}`
  const description = `${inCount}/${run.players_needed} confirmed · ${run.location_name} · Tap to respond`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${appUrl}/run/${id}`,
      siteName: 'Ballzone',
      type: 'website',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        }
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  }
}

export default function RunLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
