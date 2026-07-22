import {NextResponse} from 'next/server'
import {sanity} from '@/lib/sanity'

// One like per device per pint, toggled. The device id doubles as the array
// item _key, which is what makes the toggle idempotent. It goes into a GROQ
// path below, so only a strict id shape is accepted.
const DEVICE_ID = /^[a-zA-Z0-9-]{8,64}$/

export async function POST(
  req: Request,
  {params}: {params: Promise<{id: string}>},
) {
  const {id} = await params
  const body = await req.json().catch(() => ({}))
  const deviceId = typeof body.deviceId === 'string' ? body.deviceId : ''
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 60) : ''
  if (!DEVICE_ID.test(deviceId)) {
    return NextResponse.json({error: 'deviceId is required'}, {status: 400})
  }

  const attempt = await sanity.fetch(
    `*[_type == "attempt" && _id == $id][0]{"liked": coalesce($device in likes[]._key, false)}`,
    {id, device: deviceId},
  )
  if (!attempt) return NextResponse.json({error: 'Not found'}, {status: 404})

  if (attempt.liked) {
    await sanity.patch(id).unset([`likes[_key=="${deviceId}"]`]).commit()
  } else {
    await sanity
      .patch(id)
      .setIfMissing({likes: []})
      .insert('after', 'likes[-1]', [
        {_key: deviceId, ...(name && {name}), at: new Date().toISOString()},
      ])
      .commit()
  }

  const likes = await sanity.fetch(
    `count(*[_type == "attempt" && _id == $id][0].likes)`,
    {id},
  )
  return NextResponse.json({liked: !attempt.liked, likes: likes ?? 0})
}
