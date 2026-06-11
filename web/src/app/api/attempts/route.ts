import {NextResponse} from 'next/server'
import {sanity} from '@/lib/sanity'

export async function POST(req: Request) {
  const form = await req.formData()
  const playerId = form.get('playerId')
  const photo = form.get('photo')
  const mode = form.get('mode') === 'dropHarp' ? 'dropHarp' : 'splitG'
  if (typeof playerId !== 'string' || !(photo instanceof File)) {
    return NextResponse.json({error: 'playerId and photo are required'}, {status: 400})
  }

  const buffer = Buffer.from(await photo.arrayBuffer())
  const asset = await sanity.assets.upload('image', buffer, {
    filename: `full-pint-${Date.now()}.jpg`,
    contentType: photo.type || 'image/jpeg',
  })

  const attempt = await sanity.create({
    _type: 'attempt',
    player: {_type: 'reference', _ref: playerId},
    mode,
    status: 'judgingFullPint',
    fullPint: {
      _type: 'image',
      asset: {_type: 'reference', _ref: asset._id},
    },
  })

  return NextResponse.json({_id: attempt._id})
}
