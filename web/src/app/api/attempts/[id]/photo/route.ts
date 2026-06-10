import {NextResponse} from 'next/server'
import {sanity} from '@/lib/sanity'

// Attach a photo to an existing attempt: phase "full" (retakes) or "split".
export async function POST(
  req: Request,
  {params}: {params: Promise<{id: string}>},
) {
  const {id} = await params
  const form = await req.formData()
  const photo = form.get('photo')
  const phase = form.get('phase')
  if (!(photo instanceof File) || (phase !== 'full' && phase !== 'split')) {
    return NextResponse.json(
      {error: 'photo and phase ("full" | "split") are required'},
      {status: 400},
    )
  }

  const buffer = Buffer.from(await photo.arrayBuffer())
  const asset = await sanity.assets.upload('image', buffer, {
    filename: `${phase}-pint-${Date.now()}.jpg`,
    contentType: photo.type || 'image/jpeg',
  })

  const imageField = {
    _type: 'image',
    asset: {_type: 'reference', _ref: asset._id},
  }

  if (phase === 'full') {
    await sanity
      .patch(id)
      .set({fullPint: imageField, status: 'judgingFullPint'})
      .commit()
  } else {
    await sanity
      .patch(id)
      .set({splitPint: imageField, status: 'judgingSplit'})
      .commit()
  }

  return NextResponse.json({ok: true})
}
