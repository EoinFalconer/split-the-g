import {NextResponse} from 'next/server'
import {sanity} from '@/lib/sanity'

export const dynamic = 'force-dynamic'

export async function GET() {
  const data = await sanity.fetch(`{
    "players": *[_type == "player"]{
      _id,
      name,
      "gs": count(*[_type == "attempt" && player._ref == ^._id && coalesce(mode, "splitG") == "splitG" && splitVerdict.split == true]),
      "harps": count(*[_type == "attempt" && player._ref == ^._id && mode == "dropHarp" && splitVerdict.split == true]),
      "attempts": count(*[_type == "attempt" && player._ref == ^._id && defined(splitVerdict)]),
      "best": math::max(*[_type == "attempt" && player._ref == ^._id && defined(splitVerdict)].splitVerdict.score)
    }[attempts > 0]{..., "points": gs + harps} | order(points desc, best desc),
    "latest": *[_type == "attempt" && status == "scored"] | order(splitVerdict.judgedAt desc)[0]{
      "playerName": player->name,
      "mode": coalesce(mode, "splitG"),
      splitVerdict
    },
    "recent": *[_type == "attempt" && status == "scored" && defined(splitPint.asset)]
      | order(splitVerdict.judgedAt desc)[0...18]{
        _id,
        "playerName": player->name,
        "mode": coalesce(mode, "splitG"),
        "img": splitPint.asset->url,
        "split": splitVerdict.split,
        "score": splitVerdict.score,
        localGeometry{boxX, boxY, boxW, boxH, lineYNorm}
      }
  }`)
  return NextResponse.json(data)
}
