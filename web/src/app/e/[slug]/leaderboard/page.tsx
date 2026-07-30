import {notFound} from 'next/navigation'
import {getEventConfig} from '@/lib/get-event'
import {LeaderboardView} from '@/components/LeaderboardView'

export const dynamic = 'force-dynamic'

export default async function EventLeaderboardPage({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params
  const event = await getEventConfig(slug)
  if (!event) notFound()
  return <LeaderboardView event={event} />
}
