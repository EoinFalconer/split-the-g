import {NextResponse} from 'next/server'
import {sanity} from '@/lib/sanity'
import {WEDDING_DAY_FROM, WEDDING_DAY_TO} from '@/lib/wedding'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const board = new URL(req.url).searchParams.get('board') === 'wedding' ? 'wedding' : 'practice'
  // Wedding board: only pints poured on the day itself. Practice board: every
  // other pint, so the warm-up championship survives the big day untouched.
  const inWindow = '_createdAt >= $from && _createdAt < $to'
  const day = board === 'wedding' ? inWindow : `!(${inWindow})`

  const data = await sanity.fetch(
    `{
    "players": *[_type == "player"]{
      _id,
      name,
      "gs": count(*[_type == "attempt" && ${day} && player._ref == ^._id && coalesce(mode, "splitG") == "splitG" && splitVerdict.split == true]),
      "harps": count(*[_type == "attempt" && ${day} && player._ref == ^._id && mode == "dropHarp" && splitVerdict.split == true]),
      "attempts": count(*[_type == "attempt" && ${day} && player._ref == ^._id && defined(splitVerdict)]),
      "best": math::max(*[_type == "attempt" && ${day} && player._ref == ^._id && defined(splitVerdict)].splitVerdict.score)
    }[attempts > 0]{..., "points": gs + harps} | order(points desc, best desc),
    "latest": *[_type == "attempt" && ${day} && status == "scored"] | order(splitVerdict.judgedAt desc)[0]{
      "playerName": player->name,
      "mode": coalesce(mode, "splitG"),
      splitVerdict
    },
    "recent": *[_type == "attempt" && ${day} && status == "scored" && defined(splitPint.asset)]
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
    {from: WEDDING_DAY_FROM, to: WEDDING_DAY_TO},
  )
  return NextResponse.json({...data, board})
}
