import {NextResponse} from 'next/server'
import {sanity} from '@/lib/sanity'
import {slugify, THEME_PRESETS} from '@/lib/event'

export const dynamic = 'force-dynamic'

// Create an event. Names become a unique slug; a theme preset (or a custom
// ink/coral pair) drives the whole look. No auth yet — concierge/self-serve MVP.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 60) : ''
  if (!name) return NextResponse.json({error: 'An event name is required'}, {status: 400})

  const preset = THEME_PRESETS[body.theme] ?? THEME_PRESETS.classic
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

  // Unique slug: base off the name, add -2, -3… if taken.
  const base = slugify(name)
  let slug = base
  for (let n = 2; n < 50; n++) {
    const taken = await sanity.fetch(`count(*[_type == "event" && slug == $slug]) > 0`, {slug})
    if (!taken) break
    slug = `${base}-${n}`
  }

  const doc = await sanity.create({
    _type: 'event',
    name,
    slug,
    kicker: str(body.kicker, 60) || 'the championship',
    hello: str(body.hello, 40) || 'sláinte',
    signoff: str(body.signoff, 60),
    dateLabel: str(body.dateLabel, 40),
    startsAt: str(body.startsAt, 40) || null,
    endsAt: str(body.endsAt, 40) || null,
    championshipLabel: str(body.championshipLabel, 30) || 'the main event',
    practiceLabel: str(body.practiceLabel, 30) || 'warm-up',
    themeInk: preset.ink,
    themeCoral: preset.coral,
  })

  return NextResponse.json({_id: doc._id, slug})
}
