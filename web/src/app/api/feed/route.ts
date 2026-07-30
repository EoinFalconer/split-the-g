import {NextResponse} from 'next/server'
import {sanity} from '@/lib/sanity'
import {eventFilter} from '@/lib/event'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 12

// The homescreen feed: scored attempts, newest first, with like state for the
// requesting device. `before` (a _createdAt cursor) pages older posts in.
// Scoped to one event; the wedding is the legacy (unreferenced) documents.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const device = url.searchParams.get('device') ?? ''
  const before = url.searchParams.get('before')
  const eventId = url.searchParams.get('event') || null

  const items = await sanity.fetch(
    `*[_type == "attempt" && status == "scored" && defined(splitPint.asset)
        && ${eventFilter(eventId)}
        && ($before == null || _createdAt < $before)]
      | order(_createdAt desc)[0...${PAGE_SIZE}]{
        _id,
        "playerName": player->name,
        "mode": coalesce(mode, "splitG"),
        "img": splitPint.asset->url,
        "imgW": splitPint.asset->metadata.dimensions.width,
        "imgH": splitPint.asset->metadata.dimensions.height,
        "selfie": selfie.asset->url,
        "split": splitVerdict.split,
        "points": coalesce(splitVerdict.points, select(splitVerdict.split => 1, 0)),
        "score": splitVerdict.score,
        "banter": splitVerdict.banter,
        caption,
        venue,
        "createdAt": _createdAt,
        localGeometry{boxX, boxY, boxW, boxH, lineYNorm},
        "likes": coalesce(count(likes), 0),
        "liked": coalesce($device in likes[]._key, false),
        "likedNames": coalesce(likes[defined(name) && name != ""][0...3].name, [])
      }`,
    {device, before: before ?? null, eventId},
  )

  return NextResponse.json({items, hasMore: items.length === PAGE_SIZE})
}
