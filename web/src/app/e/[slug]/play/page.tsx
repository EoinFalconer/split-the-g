import {notFound} from 'next/navigation'
import {getEventConfig} from '@/lib/get-event'
import {PlayFlow} from '@/components/PlayFlow'

export const dynamic = 'force-dynamic'

export default async function EventPlayPage({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params
  const event = await getEventConfig(slug)
  if (!event) notFound()
  return <PlayFlow event={event} />
}
