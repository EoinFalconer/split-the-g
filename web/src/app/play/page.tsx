import {redirect} from 'next/navigation'
import {WEDDING_EVENT} from '@/lib/event'

// Legacy wedding link — keep it working by sending it to the built-in event.
export default function LegacyPlay() {
  redirect(`/e/${WEDDING_EVENT.slug}/play`)
}
