import QRCode from 'qrcode'
import {sanity} from '@/lib/sanity'
import {eventUrl, eventFromDoc} from '@/lib/event'

export const dynamic = 'force-dynamic'

// A themed QR code (ink on paper) for an event's public URL — for the table
// cards / posters. ?format=svg for print-crisp vector, otherwise PNG.
export async function GET(_req: Request, {params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params
  const url = new URL(_req.url)
  const doc = await sanity.fetch(`*[_type == "event" && slug == $slug][0]`, {slug})
  if (!doc && slug !== 'serine-eoin') return new Response('Not found', {status: 404})
  const ink = doc ? eventFromDoc(doc).theme.ink : '#414198'

  const target = eventUrl(slug)
  const opts = {
    errorCorrectionLevel: 'Q' as const,
    margin: 2,
    color: {dark: ink, light: '#f6f0e1'},
    width: 1024,
  }

  if (url.searchParams.get('format') === 'svg') {
    const svg = await QRCode.toString(target, {...opts, type: 'svg'})
    return new Response(svg, {headers: {'Content-Type': 'image/svg+xml'}})
  }
  const png = await QRCode.toBuffer(target, {...opts, type: 'png'})
  return new Response(new Uint8Array(png), {headers: {'Content-Type': 'image/png'}})
}
