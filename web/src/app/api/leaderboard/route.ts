import {NextResponse} from 'next/server'
import {sanity} from '@/lib/sanity'
import {eventFilter} from '@/lib/event'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const eventId = url.searchParams.get('event') || null
  const from = url.searchParams.get('from') || null
  const to = url.searchParams.get('to') || null
  const board = url.searchParams.get('board') === 'championship' ? 'championship' : 'practice'
  const scope = eventFilter(eventId)

  // With a window: the championship board is pints poured inside it, practice is
  // everything else. Without one (a generic event): a single board of all pints.
  const inWindow = '_createdAt >= $from && _createdAt < $to'
  const hasWindow = Boolean(from && to)
  const day = !hasWindow ? 'true' : board === 'championship' ? inWindow : `!(${inWindow})`
  const attempt = `${scope} && ${day}`

  const data = await sanity.fetch(
    `{
    "players": *[_type == "player" && ${scope}]{
      _id,
      name,
      "gs": count(*[_type == "attempt" && ${attempt} && player._ref == ^._id && coalesce(mode, "splitG") == "splitG" && splitVerdict.split == true]),
      "harps": count(*[_type == "attempt" && ${attempt} && player._ref == ^._id && mode == "dropHarp" && splitVerdict.split == true]),
      "attempts": count(*[_type == "attempt" && ${attempt} && player._ref == ^._id && defined(splitVerdict)]),
      "best": math::max(*[_type == "attempt" && ${attempt} && player._ref == ^._id && defined(splitVerdict)].splitVerdict.score),
      // 1 for the middle of the G / the harp gap, ½ for an off-centre split.
      // Attempts judged before points existed pay the old flat 1 per hit.
      "points": math::sum(*[_type == "attempt" && ${attempt} && player._ref == ^._id && defined(splitVerdict)]{
        "v": coalesce(splitVerdict.points, select(splitVerdict.split => 1, 0))
      }.v)
    }[attempts > 0] | order(points desc, best desc),
    "latest": *[_type == "attempt" && ${attempt} && status == "scored"] | order(splitVerdict.judgedAt desc)[0]{
      "playerName": player->name,
      "mode": coalesce(mode, "splitG"),
      splitVerdict
    },
    "recent": *[_type == "attempt" && ${attempt} && status == "scored" && defined(splitPint.asset)]
      | order(splitVerdict.judgedAt desc)[0...18]{
        _id,
        "playerName": player->name,
        "mode": coalesce(mode, "splitG"),
        "img": splitPint.asset->url,
        "split": splitVerdict.split,
        "score": splitVerdict.score,
        localGeometry{boxX, boxY, boxW, boxH, lineYNorm}
      }
  }`,
    {from, to, eventId},
  )
  return NextResponse.json({...data, board, hasWindow})
}
