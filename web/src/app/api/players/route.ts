import {NextResponse} from 'next/server'
import {sanity} from '@/lib/sanity'
import {eventFilter} from '@/lib/event'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const eventId = new URL(req.url).searchParams.get('event') || null
  const players = await sanity.fetch(
    `*[_type == "player" && ${eventFilter(eventId)}] | order(name asc) {_id, name}`,
    {eventId},
  )
  return NextResponse.json(players)
}

export async function POST(req: Request) {
  const body = await req.json()
  const trimmed = (body?.name ?? '').trim()
  const eventId = typeof body?.eventId === 'string' && body.eventId ? body.eventId : null
  if (!trimmed) {
    return NextResponse.json({error: 'Name is required'}, {status: 400})
  }
  // Names are unique within an event, not across the whole product.
  const existing = await sanity.fetch(
    `*[_type == "player" && ${eventFilter(eventId)} && lower(name) == lower($name)][0]{_id, name}`,
    {name: trimmed, eventId},
  )
  if (existing) return NextResponse.json(existing)

  const created = await sanity.create({
    _type: 'player',
    name: trimmed,
    ...(eventId && {event: {_type: 'reference', _ref: eventId}}),
  })
  return NextResponse.json({_id: created._id, name: trimmed})
}
