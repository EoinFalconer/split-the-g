import {notFound} from 'next/navigation'
import {getEventConfig} from '@/lib/get-event'
import {Feed} from '@/components/Feed'

export const dynamic = 'force-dynamic'

export default async function EventFeedPage({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params
  const event = await getEventConfig(slug)
  if (!event) notFound()
  return <Feed event={event} />
}
