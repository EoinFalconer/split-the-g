import {NextResponse} from 'next/server'
import {sanity} from '@/lib/sanity'

export async function GET() {
  const players = await sanity.fetch(
    `*[_type == "player"] | order(name asc) {_id, name}`,
  )
  return NextResponse.json(players)
}

export async function POST(req: Request) {
  const {name} = await req.json()
  const trimmed = (name ?? '').trim()
  if (!trimmed) {
    return NextResponse.json({error: 'Name is required'}, {status: 400})
  }
  const existing = await sanity.fetch(
    `*[_type == "player" && lower(name) == lower($name)][0]{_id, name}`,
    {name: trimmed},
  )
  if (existing) return NextResponse.json(existing)

  const created = await sanity.create({_type: 'player', name: trimmed})
  return NextResponse.json({_id: created._id, name: trimmed})
}
