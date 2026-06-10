import {NextResponse} from 'next/server'
import {sanity} from '@/lib/sanity'

export async function GET(
  _req: Request,
  {params}: {params: Promise<{id: string}>},
) {
  const {id} = await params
  const attempt = await sanity.fetch(
    `*[_type == "attempt" && _id == $id][0]{
      _id,
      status,
      lastRejection,
      fullPintVerdict,
      splitVerdict,
      "playerName": player->name
    }`,
    {id},
  )
  if (!attempt) return NextResponse.json({error: 'Not found'}, {status: 404})
  return NextResponse.json(attempt)
}
