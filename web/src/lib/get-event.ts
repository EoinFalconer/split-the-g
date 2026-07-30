import 'server-only'
import {cache} from 'react'
import {sanity} from './sanity'
import {WEDDING_EVENT, eventFromDoc, type EventConfig} from './event'

// Resolve an event by slug. The wedding is the built-in first event (no Sanity
// doc, legacy data), so its slug always resolves; everything else is a doc.
// Cached per request so a layout and its page don't fetch twice.
export const getEventConfig = cache(async (slug: string): Promise<EventConfig | null> => {
  if (slug === WEDDING_EVENT.slug) return WEDDING_EVENT
  const doc = await sanity.fetch(`*[_type == "event" && slug == $slug][0]`, {slug})
  return doc ? eventFromDoc(doc) : null
})
