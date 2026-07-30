import {ImageResponse} from 'next/og'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {sanity} from '@/lib/sanity'
import {scorePct, perfectLabel, fmtPoints} from '@/lib/score'
import {WEDDING_EVENT, APP_URL} from '@/lib/event'

export const runtime = 'nodejs'

// A 9:16 Instagram-story card of a single pint: the split shot as the hero with
// the detected G and beer-line drawn on, the drinker tucked bottom-right like
// BeReal, and the score. Shareable straight to a story to pull new players in.
const W = 1080
const H = 1920
const PAPER = '#f6f0e1'

const pct = (n: number) => `${n * 100}%`

// Satori has no color-mix; blend hex ourselves to derive the ink ramp per theme.
function mixHex(a: string, b: string, t: number): string {
  const h = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16))
  const [r1, g1, b1] = h(a)
  const [r2, g2, b2] = h(b)
  const c = (x: number, y: number) => Math.round(x + (y - x) * t)
  return `#${[c(r1, r2), c(g1, g2), c(b1, b2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

// Mini Moniker (display) is bundled; Nunito Sans (body) is best-effort from a
// CDN — if it can't be fetched we fall back to the display face everywhere.
let fontsPromise: Promise<{name: string; data: ArrayBuffer; weight: 400 | 700}[]> | null = null
function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const fonts: {name: string; data: ArrayBuffer; weight: 400 | 700}[] = []
      const mini = await readFile(join(process.cwd(), 'public/fonts/mini-moniker-regular.ttf'))
      fonts.push({name: 'Moniker', data: mini.buffer as ArrayBuffer, weight: 400})
      const cdn = '@fontsource/nunito-sans@5.0.13/files/nunito-sans-latin'
      for (const weight of [400, 700] as const) {
        try {
          const res = await fetch(`https://cdn.jsdelivr.net/npm/${cdn}-${weight}-normal.woff`)
          if (res.ok) fonts.push({name: 'Nunito', data: await res.arrayBuffer(), weight})
        } catch {
          // no body font — Moniker covers everything
        }
      }
      return fonts
    })()
  }
  return fontsPromise
}

export async function GET(_req: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params
  // Show whatever domain is serving the card (product vs shrine).
  const APP_HOST = _req.headers.get('host') || new URL(APP_URL).host
  const a = await sanity.fetch(
    `*[_type == "attempt" && _id == $id && status == "scored"][0]{
      "playerName": player->name,
      "mode": coalesce(mode, "splitG"),
      "img": splitPint.asset->url,
      "imgW": splitPint.asset->metadata.dimensions.width,
      "imgH": splitPint.asset->metadata.dimensions.height,
      "selfie": selfie.asset->url,
      "split": splitVerdict.split,
      "points": coalesce(splitVerdict.points, select(splitVerdict.split => 1, 0)),
      "score": splitVerdict.score,
      venue,
      localGeometry{boxX, boxY, boxW, boxH, lineYNorm},
      "themeInk": event->themeInk,
      "themeCoral": event->themeCoral,
      "kicker": event->kicker,
      "signoff": event->signoff
    }`,
    {id},
  )
  if (!a) return new Response('Not found', {status: 404})

  // Theme from the attempt's event; legacy wedding pints use the classic look.
  const INK = a.themeInk || WEDDING_EVENT.theme.ink
  const CORAL = a.themeCoral || WEDDING_EVENT.theme.coral
  const INK_MID = mixHex(INK, PAPER, 0.35)
  const INK_SOFT = mixHex(INK, PAPER, 0.55)
  const kicker = (a.kicker || WEDDING_EVENT.kicker).toUpperCase()
  const signoff = a.signoff || WEDDING_EVENT.signoff

  const fonts = await loadFonts()
  const body = fonts.some((f) => f.name === 'Nunito') ? 'Nunito' : 'Moniker'

  // Hero sized to the pint's own aspect so the drawn overlay stays aligned.
  const ratio = a.imgW && a.imgH ? a.imgW / a.imgH : 0.75
  const heroH = 1150
  const heroW = Math.min(952, Math.round(heroH * ratio))
  const g = a.localGeometry
  const hasBox = g && g.boxX != null && g.boxY != null && g.boxW != null && g.boxH != null
  const won = a.mode === 'dropHarp' ? a.split : a.points === 1
  const verdictWord = !a.split
    ? 'miss'
    : a.mode === 'dropHarp'
      ? 'harp dropped'
      : a.points === 1
        ? 'perfect split'
        : 'on the G'

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '70px 64px 56px',
          background: `radial-gradient(120% 80% at 50% 0%, #fbf7ec 0%, ${PAPER} 55%, #efe7d2 100%)`,
          fontFamily: body,
        }}
      >
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          <div style={{display: 'flex', alignItems: 'center', fontFamily: 'Moniker', fontSize: 88, color: INK, position: 'relative'}}>
            <span>Split the&nbsp;</span>
            <div style={{display: 'flex', position: 'relative'}}>
              <span>G</span>
              <div style={{position: 'absolute', left: -6, right: -6, top: '54%', height: 6, background: CORAL, borderRadius: 3}} />
            </div>
          </div>
          <div style={{display: 'flex', fontSize: 22, letterSpacing: 5, color: INK_MID, fontWeight: 700, marginTop: 6}}>
            {kicker}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            position: 'relative',
            width: heroW,
            height: heroH,
            borderRadius: 28,
            overflow: 'hidden',
            border: `3px solid ${INK_SOFT}`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${a.img}?w=900&fm=jpg`} alt="" width={heroW} height={heroH} style={{objectFit: 'cover'}} />
          {hasBox && (
            <div
              style={{
                display: 'flex',
                position: 'absolute',
                left: pct(g.boxX),
                top: pct(g.boxY),
                width: pct(g.boxW),
                height: pct(g.boxH),
                border: `3px solid ${INK_SOFT}`,
                borderRadius: 4,
              }}
            />
          )}
          {hasBox && g.lineYNorm != null && (
            <div
              style={{
                display: 'flex',
                position: 'absolute',
                left: 0,
                top: pct(g.lineYNorm),
                width: heroW,
                height: 5,
                background: a.split ? CORAL : PAPER,
              }}
            />
          )}
          {a.selfie && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`${a.selfie}?w=300&h=380&fit=crop&fm=jpg`}
              alt=""
              width={200}
              height={256}
              style={{position: 'absolute', right: 24, bottom: 24, borderRadius: 18, border: `5px solid ${PAPER}`, objectFit: 'cover'}}
            />
          )}
        </div>

        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          <div style={{display: 'flex', fontFamily: 'Moniker', fontSize: 76, color: INK, lineHeight: 1}}>
            {a.playerName}
          </div>
          <div style={{display: 'flex', alignItems: 'baseline', marginTop: 10}}>
            <span style={{fontSize: 120, fontWeight: 700, color: won ? CORAL : INK}}>{scorePct(a.score ?? 0)}%</span>
            <span style={{fontSize: 34, color: INK_MID, marginLeft: 18, fontStyle: 'italic'}}>{perfectLabel(a.mode)}</span>
          </div>
          <div style={{display: 'flex', fontSize: 30, letterSpacing: 4, color: won ? CORAL : INK_SOFT, fontWeight: 700, marginTop: 8}}>
            {verdictWord.toUpperCase()}
            {a.split ? ` · ${fmtPoints(a.points)} PT` : ''}
            {a.venue ? `  ·  📍 ${a.venue}` : ''}
          </div>
        </div>

        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          <div style={{display: 'flex', fontSize: 34, fontWeight: 700, letterSpacing: 1, color: INK}}>
            {APP_HOST}
          </div>
          {signoff ? (
            <div style={{display: 'flex', fontFamily: 'Moniker', fontSize: 30, color: CORAL, marginTop: 4}}>
              {signoff}
            </div>
          ) : null}
        </div>
      </div>
    ),
    {width: W, height: H, fonts: fonts.map((f) => ({name: f.name, data: f.data, weight: f.weight, style: 'normal' as const}))},
  )
}
