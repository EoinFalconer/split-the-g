import {NextResponse} from 'next/server'
import {sanity} from '@/lib/sanity'

// The player's own words on their pint: an Instagram-style caption and the
// pub/venue it was poured in. Human-written only — the judge's banter stays
// its own clearly-attributed field.
export async function POST(
  req: Request,
  {params}: {params: Promise<{id: string}>},
) {
  const {id} = await params
  const body = await req.json().catch(() => ({}))
  const caption =
    typeof body.caption === 'string' ? body.caption.trim().slice(0, 140) : null
  const venue = typeof body.venue === 'string' ? body.venue.trim().slice(0, 80) : null
  if (caption === null && venue === null) {
    return NextResponse.json({error: 'caption or venue is required'}, {status: 400})
  }

  const exists = await sanity.fetch(`defined(*[_type == "attempt" && _id == $id][0])`, {id})
  if (!exists) return NextResponse.json({error: 'Not found'}, {status: 404})

  // Empty string means "clear it"; null means the field wasn't sent. Build a
  // single set/unset each — chained .unset() calls replace, not append.
  const sets: Record<string, string> = {}
  const unsets: string[] = []
  if (caption !== null) (caption ? (sets.caption = caption) : unsets.push('caption'))
  if (venue !== null) (venue ? (sets.venue = venue) : unsets.push('venue'))
  let patch = sanity.patch(id)
  if (Object.keys(sets).length > 0) patch = patch.set(sets)
  if (unsets.length > 0) patch = patch.unset(unsets)
  await patch.commit()

  return NextResponse.json({ok: true, caption, venue})
}
