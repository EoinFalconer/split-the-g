import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {getEventConfig} from '@/lib/get-event'
import {themeVars} from '@/lib/event'

export async function generateMetadata({
  params,
}: {
  params: Promise<{slug: string}>
}): Promise<Metadata> {
  const {slug} = await params
  const event = await getEventConfig(slug)
  if (!event) return {title: 'Split the G'}
  return {
    title: `${event.name} — Split the G`,
    description: `${event.kicker} · the Split the G championship`,
  }
}

// Applies the event's theme by overriding the ink/coral CSS variables for the
// whole subtree — every Tailwind ink/coral utility inside re-themes for free.
export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{slug: string}>
}) {
  const {slug} = await params
  const event = await getEventConfig(slug)
  if (!event) notFound()
  return <div style={themeVars(event.theme) as React.CSSProperties}>{children}</div>
}
