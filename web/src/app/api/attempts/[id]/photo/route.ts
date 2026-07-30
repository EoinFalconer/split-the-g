import {NextResponse} from 'next/server'
import {sanity} from '@/lib/sanity'
import {parseGeometry} from '@/lib/geometry'

// Attach a photo to an existing attempt: phase "full" (retakes) or "split".
export async function POST(
  req: Request,
  {params}: {params: Promise<{id: string}>},
) {
  const {id} = await params
  const form = await req.formData()
  const photo = form.get('photo')
  const phase = form.get('phase')
  const geometry = parseGeometry(form.get('geometry'))
  if (!(photo instanceof File) || (phase !== 'full' && phase !== 'split')) {
    return NextResponse.json(
      {error: 'photo and phase ("full" | "split") are required'},
      {status: 400},
    )
  }
  // Split retakes are detector-only too — same rule as a fresh attempt.
  if (phase === 'split' && !geometry) {
    return NextResponse.json(
      {error: 'The camera needs to recognise the G and the line before it can submit'},
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
    // Optional BeReal-style second shot of the drinker on a split retake.
    const selfieFile = form.get('selfie')
    let selfieField: typeof imageField | null = null
    if (selfieFile instanceof File) {
      const selfieAsset = await sanity.assets.upload(
        'image',
        Buffer.from(await selfieFile.arrayBuffer()),
        {filename: `selfie-${Date.now()}.jpg`, contentType: selfieFile.type || 'image/jpeg'},
      )
      selfieField = {_type: 'image', asset: {_type: 'reference', _ref: selfieAsset._id}}
    }
    await sanity
      .patch(id)
      .set({
        splitPint: imageField,
        status: 'judgingSplit',
        ...(geometry && {localGeometry: {_type: 'localGeometry', ...geometry}}),
        ...(selfieField && {selfie: selfieField}),
      })
      .unset(geometry ? [] : ['localGeometry'])
      .commit()
  }

  return NextResponse.json({ok: true})
}
