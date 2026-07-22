'use client'

import * as ort from 'onnxruntime-web'

// In-browser G-logo detector (YOLO11n exported to ONNX, 320px, 1 class) plus a
// classical beer-line finder. See docs/live-detection-spec.md.

const MODEL_URL = '/models/g-detector.onnx'
const INPUT_SIZE = 320
const CONF_THRESHOLD = 0.4

export type GBox = {x: number; y: number; w: number; h: number; conf: number}
export type Detection = {
  box: GBox // in source-video pixel coordinates
  lineY: number | null // beer line y in source-video pixels
  score: number | null
  hit: boolean
}

// The deterministic geometry sent with the capture. `lineInG` (normalised to
// the G's own height) drives the verdict; the box rect + line (normalised to
// the image, 0..1) let the leaderboard redraw the overlay on the saved photo.
export type CaptureGeometry = {
  split: boolean
  score: number
  // line position relative to the G box: 0 = top of G, 1 = bottom of G
  lineInG: number
  conf: number
  // normalised to the captured image, for redrawing the overlay
  boxX?: number
  boxY?: number
  boxW?: number
  boxH?: number
  lineYNorm?: number
}

export function toGeometry(
  det: Detection | null,
  imgW: number,
  imgH: number,
): CaptureGeometry | null {
  if (!det || det.lineY == null || det.score == null || det.box.h <= 0) return null
  const r = (n: number) => Math.round(n * 10000) / 10000
  return {
    split: det.hit,
    score: det.score,
    lineInG: Math.round(((det.lineY - det.box.y) / det.box.h) * 1000) / 1000,
    conf: Math.round(det.box.conf * 1000) / 1000,
    ...(imgW > 0 && imgH > 0
      ? {
          boxX: r(det.box.x / imgW),
          boxY: r(det.box.y / imgH),
          boxW: r(det.box.w / imgW),
          boxH: r(det.box.h / imgH),
          lineYNorm: r(det.lineY / imgH),
        }
      : {}),
  }
}

let sessionPromise: Promise<ort.InferenceSession> | null = null

export function loadDetector(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    ort.env.wasm.wasmPaths = '/ort/'
    sessionPromise = ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ['webgpu', 'wasm'],
    }).catch((err) => {
      sessionPromise = null
      throw err
    })
  }
  return sessionPromise
}

const work = typeof document !== 'undefined' ? document.createElement('canvas') : null

// Square centre-crop of the video, resized to the model input. Returns the
// crop offset/scale so detections map back to source pixels.
function preprocess(video: HTMLVideoElement) {
  const canvas = work!
  canvas.width = INPUT_SIZE
  canvas.height = INPUT_SIZE
  const side = Math.min(video.videoWidth, video.videoHeight)
  const sx = (video.videoWidth - side) / 2
  const sy = (video.videoHeight - side) / 2
  const ctx = canvas.getContext('2d', {willReadFrequently: true})!
  ctx.drawImage(video, sx, sy, side, side, 0, 0, INPUT_SIZE, INPUT_SIZE)
  const {data} = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE)
  const n = INPUT_SIZE * INPUT_SIZE
  const input = new Float32Array(3 * n)
  for (let i = 0; i < n; i++) {
    input[i] = data[i * 4] / 255
    input[n + i] = data[i * 4 + 1] / 255
    input[2 * n + i] = data[i * 4 + 2] / 255
  }
  return {input, sx, sy, scale: side / INPUT_SIZE}
}

// YOLO11 single-class output: [1, 5, N] with rows cx, cy, w, h, conf.
function bestBox(output: Float32Array, dims: readonly number[]): GBox | null {
  const numBoxes = dims[2]
  let best = -1
  let bestConf = CONF_THRESHOLD
  for (let i = 0; i < numBoxes; i++) {
    const conf = output[4 * numBoxes + i]
    if (conf > bestConf) {
      bestConf = conf
      best = i
    }
  }
  if (best < 0) return null
  const cx = output[best]
  const cy = output[numBoxes + best]
  const w = output[2 * numBoxes + best]
  const h = output[3 * numBoxes + best]
  return {x: cx - w / 2, y: cy - h / 2, w, h, conf: bestConf}
}

// The stout/foam boundary is the strongest bright→dark vertical transition in a
// band around the G. Scan row luminance means in a window around the logo.
function findBeerLine(video: HTMLVideoElement, box: GBox): number | null {
  const canvas = work!
  const bandX = Math.max(0, box.x - box.w)
  const bandW = Math.min(video.videoWidth - bandX, box.w * 3)
  const bandY = Math.max(0, box.y - box.h * 2.5)
  const bandH = Math.min(video.videoHeight - bandY, box.h * 6)
  const outW = 64
  const outH = 160
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d', {willReadFrequently: true})!
  ctx.drawImage(video, bandX, bandY, bandW, bandH, 0, 0, outW, outH)
  const {data} = ctx.getImageData(0, 0, outW, outH)
  const rows = new Float32Array(outH)
  for (let y = 0; y < outH; y++) {
    let sum = 0
    for (let x = 0; x < outW; x++) {
      const i = (y * outW + x) * 4
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    }
    rows[y] = sum / outW
  }
  let bestRow = -1
  let bestDrop = 18 // minimum luminance drop to count as the line
  for (let y = 2; y < outH - 2; y++) {
    const drop = (rows[y - 2] + rows[y - 1]) / 2 - (rows[y + 1] + rows[y + 2]) / 2
    if (drop > bestDrop) {
      bestDrop = drop
      bestRow = y
    }
  }
  if (bestRow < 0) return null
  return bandY + (bestRow / outH) * bandH
}

// Target zones, expressed relative to the detected G box (whose top edge is the
// top of the GUINNESS lettering). lineInG = (lineY - box.y) / box.h, so 0 = top
// of the G, 1 = bottom of the G, negative = above the lettering toward the harp.
//
//  • splitG   — the line must pass through the G itself: lineInG in [0, 1].
//  • dropHarp — the old-school target is the gap between the top of the wordmark
//    and the harp. We only detect the G, not the harp, so the zone is a heuristic
//    relative to the G's height: the top ~20% of the G up into the gap above it,
//    i.e. lineInG in [-0.9, 0.2]. (A pixel-exact harp gap would need a second
//    detector class for the harp — a future training pass.)
export const ZONES = {
  splitG: {center: 0.5, half: 0.5},
  dropHarp: {center: -0.35, half: 0.55},
} as const

// The full-point band for Split the G: the middle of the G with a little
// leeway (±15% of the G's height). Inside it = 1 point, elsewhere on the
// G = ½ point. Mirrored in functions/judge-pint — keep the values in sync.
export const PERFECT_HALF = 0.15

// Inner full-point band in source-video pixels (Split the G only — Drop the
// Harp is all or nothing, the whole zone is the full point).
export function perfectZonePixels(box: GBox, mode: 'splitG' | 'dropHarp') {
  if (mode !== 'splitG') return null
  return {
    top: box.y + (0.5 - PERFECT_HALF) * box.h,
    bottom: box.y + (0.5 + PERFECT_HALF) * box.h,
  }
}

// Target band in source-video pixels, for drawing the aim guide on the overlay.
export function zonePixels(box: GBox, mode: 'splitG' | 'dropHarp') {
  const z = ZONES[mode]
  return {
    top: box.y + (z.center - z.half) * box.h,
    bottom: box.y + (z.center + z.half) * box.h,
  }
}

export function scoreLine(
  box: GBox,
  lineY: number,
  mode: 'splitG' | 'dropHarp',
): {score: number; hit: boolean} {
  const zone = ZONES[mode]
  const lineInG = (lineY - box.y) / box.h
  const d = Math.abs(lineInG - zone.center) / zone.half
  const hit = d <= 1
  const score = hit ? 5 - 1.25 * d : Math.max(0, 3.75 - 2 * (d - 1))
  return {score: Math.round(score * 100) / 100, hit}
}

export async function detect(
  video: HTMLVideoElement,
  mode: 'splitG' | 'dropHarp',
): Promise<Detection | null> {
  if (!video.videoWidth) return null
  const session = await loadDetector()
  const {input, sx, sy, scale} = preprocess(video)
  const tensor = new ort.Tensor('float32', input, [1, 3, INPUT_SIZE, INPUT_SIZE])
  const results = await session.run({[session.inputNames[0]]: tensor})
  const out = results[session.outputNames[0]]
  const raw = bestBox(out.data as Float32Array, out.dims)
  if (!raw) return null

  const box: GBox = {
    x: raw.x * scale + sx,
    y: raw.y * scale + sy,
    w: raw.w * scale,
    h: raw.h * scale,
    conf: raw.conf,
  }
  const lineY = findBeerLine(video, box)
  if (lineY == null) return {box, lineY: null, score: null, hit: false}
  const {score, hit} = scoreLine(box, lineY, mode)
  return {box, lineY, score, hit}
}
