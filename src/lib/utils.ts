import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRunDate(date: string): string {
  return format(parseISO(date), 'EEE, MMM d')
}

export function formatRunTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const d = new Date()
  d.setHours(hours, minutes)
  return format(d, 'h:mm a')
}

export function buildShareText(run: {
  title: string
  run_date: string
  run_time: string
  location_name: string
  id: string
}): string {
  const date = formatRunDate(run.run_date)
  const time = formatRunTime(run.run_time)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ballzone.app'
  return `🏀 ${run.title} · ${date} ${time}\n📍 ${run.location_name}\nIN / OUT / LATE 👇\n${appUrl}/run/${run.id}`
}

export function buildReminderText(run: {
  title: string
  run_date: string
  run_time: string
  id: string
}, counts: { in: number }, playersNeeded: number): string {
  const time = formatRunTime(run.run_time)
  const need = playersNeeded - counts.in
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ballzone.app'
  return `Reminder 🏀 ${run.title} TOMORROW ${time}\n${counts.in}/${playersNeeded} confirmed · Still need ${need} more\n→ ${appUrl}/run/${run.id}`
}
