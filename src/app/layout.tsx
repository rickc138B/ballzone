import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import NavDrawer from '@/components/NavDrawer'
import { PostHogProvider } from '@/components/PostHogProvider'
import { PostHogPageView } from '@/components/PostHogPageView'
import { Suspense } from 'react'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Ballzone',
  description: 'Pickup basketball, organized.',
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
  themeColor: '#f97316',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js').catch(() => {});
            });
          }
        ` }} />
        <PostHogProvider>
          <Suspense fallback={null}>
            <PostHogPageView />
          </Suspense>
          <NavDrawer />
          {children}
        </PostHogProvider>
      </body>
    </html>
  )
}
