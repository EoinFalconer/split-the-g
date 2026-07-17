'use client'

import {useCallback, useEffect, useRef, useState} from 'react'
import type {CaptureGeometry, Detection} from '@/lib/detector'

type CameraStatus = 'starting' | 'live' | 'error'

const LIVE_DETECTOR = process.env.NEXT_PUBLIC_LIVE_DETECTOR === '1'
// The full-pint proof just needs a clear look at the glass; the split shot
// needs real aim. Tolerances scale with the G's on-screen size so distance
// from the camera doesn't change the difficulty.
const CAPTURE_TUNING = {
  full: {frames: 6, tolerance: (boxH: number) => Math.max(14, boxH * 0.45)},
  split: {frames: 10, tolerance: (boxH: number) => Math.max(10, boxH * 0.2)},
} as const

// Live viewfinder for the bar-top iPad. Uses getUserMedia (requires HTTPS or
// localhost); falls back to a native file input if the camera is unavailable.
// When NEXT_PUBLIC_LIVE_DETECTOR=1 and a mode is given, an in-browser YOLO
// model tracks the G live, shows a provisional score, and auto-captures when
// the player holds steady (docs/live-detection-spec.md).
export function Camera({
  label,
  onCapture,
  mode = 'splitG',
  phase,
}: {
  label: string
  onCapture: (photo: Blob, geometry: CaptureGeometry | null) => void
  mode?: 'splitG' | 'dropHarp'
  // 'full': auto-capture when the G logo is held steady (no line/score needed).
  // 'split': auto-capture when the beer line is held steady; shows live score.
  phase?: 'full' | 'split'
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const stableRef = useRef({count: 0, last: null as number | null, captured: false})
  const lastDetRef = useRef<Detection | null>(null)
  const [status, setStatus] = useState<CameraStatus>('starting')
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  // Table-link default: guests point their own phone at their pint, so start
  // with the back camera (the bar-top kiosk can flip to the front one).
  const [facing, setFacing] = useState<'user' | 'environment'>('environment')
  const [liveScore, setLiveScore] = useState<number | null>(null)
  const [holding, setHolding] = useState(false)
  // null = loading/not applicable, true = auto-capture armed, false = model failed
  const [detectorReady, setDetectorReady] = useState<boolean | null>(null)

  const capture = useCallback(async () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    // Geometry is only meaningful on the split shot; serialise the detection
    // that's on screen right now so the verdict matches what the player saw.
    let geometry: CaptureGeometry | null = null
    if (phase === 'split' && lastDetRef.current) {
      const {toGeometry} = await import('@/lib/detector')
      geometry = toGeometry(lastDetRef.current, video.videoWidth, video.videoHeight)
    }
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob, geometry)
      },
      'image/jpeg',
      0.85,
    )
  }, [onCapture, phase])

  useEffect(() => {
    let cancelled = false
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setErrorDetail('This browser does not support camera access.')
      return
    }
    setStatus('starting')
    navigator.mediaDevices
      .getUserMedia({video: {facingMode: facing}, audio: false})
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      })
      .catch((err: Error) => {
        if (cancelled) return
        setStatus('error')
        if (err.name === 'NotAllowedError') {
          setErrorDetail(
            'Camera permission was denied. Allow camera access for this site (the camera icon in the address bar), and check System Settings → Privacy & Security → Camera on a Mac. Then reload.',
          )
        } else if (err.name === 'NotFoundError') {
          setErrorDetail('No camera found on this device.')
        } else {
          setErrorDetail(`Camera error: ${err.name} — ${err.message}`)
        }
      })
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [facing])

  // Live detection loop (feature-flagged; silently disabled if model missing).
  useEffect(() => {
    if (!LIVE_DETECTOR || !phase || status !== 'live') return
    let stopped = false
    let zonePixels: typeof import('@/lib/detector').zonePixels | null = null
    stableRef.current = {count: 0, last: null, captured: false}

    const draw = (det: Detection | null) => {
      const video = videoRef.current
      const canvas = overlayRef.current
      if (!video || !canvas) return
      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
      }
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (!det) return
      const {box, lineY} = det
      const left = Math.max(0, box.x - box.w)
      const right = Math.min(canvas.width, box.x + box.w * 2)
      ctx.strokeStyle = '#6a6aae'
      ctx.lineWidth = Math.max(3, canvas.width / 200)
      ctx.strokeRect(box.x, box.y, box.w, box.h)
      if (phase === 'split') {
        // Faint band showing the target zone you're aiming the line into.
        if (zonePixels) {
          const {top, bottom} = zonePixels(box, mode)
          ctx.fillStyle = 'rgba(224, 106, 69, 0.18)'
          ctx.fillRect(left, top, right - left, bottom - top)
        }
        if (lineY != null) {
          ctx.strokeStyle = det.hit ? '#e06a45' : '#f6f0e1'
          ctx.beginPath()
          ctx.moveTo(left, lineY)
          ctx.lineTo(right, lineY)
          ctx.stroke()
        }
      }
    }

    const run = async () => {
      let detect: typeof import('@/lib/detector').detect
      try {
        const mod = await import('@/lib/detector')
        await mod.loadDetector()
        detect = mod.detect
        zonePixels = mod.zonePixels
      } catch (err) {
        console.error('Live detector unavailable, falling back to manual:', err)
        setDetectorReady(false)
        return
      }
      if (stopped) return
      setDetectorReady(true)
      while (!stopped) {
        const video = videoRef.current
        if (video && video.videoWidth) {
          try {
            const det = await detect(video, mode)
            if (stopped) return
            lastDetRef.current = det
            draw(det)
            setLiveScore(phase === 'split' ? (det?.score ?? null) : null)
            // Stability signal: the beer line for split shots, the G box
            // position for the full-pint proof (a full pint's line sits far
            // above the logo, outside the line-finder's band).
            const signal =
              phase === 'split' ? (det?.lineY ?? null) : det ? det.box.y + det.box.h / 2 : null
            const tuning = CAPTURE_TUNING[phase]
            const s = stableRef.current
            if (signal != null && det) {
              const stable =
                s.last != null && Math.abs(signal - s.last) < tuning.tolerance(det.box.h)
              // Leaky counter: a jittery frame is a setback, not a reset.
              s.count = stable ? s.count + 1 : Math.max(0, s.count - 1)
              s.last = signal
              setHolding(s.count >= 2)
              if (s.count >= tuning.frames && !s.captured) {
                s.captured = true
                capture()
                return
              }
            } else {
              s.count = Math.max(0, s.count - 2)
              if (s.count === 0) s.last = null
              setHolding(false)
            }
          } catch (err) {
            console.error('Live detection stopped, falling back to manual:', err)
            setDetectorReady(false)
            return
          }
        }
        await new Promise((r) => setTimeout(r, 80))
      }
    }
    run()
    return () => {
      stopped = true
      setDetectorReady(null)
    }
  }, [mode, phase, status, capture])

  const autoArmed = LIVE_DETECTOR && phase != null && detectorReady === true

  const fileFallback = (
    <label className="card flex cursor-pointer flex-col items-center gap-2 text-lg text-ink-deep">
      Take a photo with the device camera instead
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="text-base"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onCapture(file, null)
        }}
      />
    </label>
  )

  if (status === 'error') {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <p className="text-2xl italic text-ink-mid">{label}</p>
        <p className="text-lg text-coral">{errorDetail}</p>
        <button
          onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}
          className="flabel underline decoration-ink-faint underline-offset-8"
        >
          try the other camera
        </button>
        {fileFallback}
      </div>
    )
  }

  const mirrored = facing === 'user' ? '-scale-x-100' : ''

  return (
    <div className="flex w-full flex-col items-center gap-7">
      <p className="max-w-lg text-center text-xl italic text-ink-mid sm:text-2xl">{label}</p>
      <div className="relative w-full max-w-md rounded-3xl border-[1.5px] border-ink-faint bg-white/45 p-2">
        {/* Mirror the front-camera preview like a mirror; captures stay unmirrored */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedData={() => setStatus('live')}
          className={`aspect-[3/4] w-full rounded-2xl border border-ink-faint/60 object-cover ${mirrored}`}
        />
        <canvas
          ref={overlayRef}
          className={`pointer-events-none absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] rounded-2xl object-cover ${mirrored}`}
        />
        {status === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-ink-faint border-t-ink" />
            <p className="px-8 text-center text-xl italic text-ink-mid">
              Waiting for the camera… if the browser asks for permission, tap Allow.
            </p>
          </div>
        )}
        {(liveScore != null || holding) && (
          <div className="absolute left-1/2 top-5 -translate-x-1/2 rounded-full bg-paper/90 px-5 py-2 text-2xl font-bold tabular-nums text-ink">
            {liveScore != null && liveScore.toFixed(2)}
            {holding && (
              <span className={`italic text-ink-mid ${liveScore != null ? 'ml-3 text-base' : 'text-xl'}`}>
                hold it…
              </span>
            )}
          </div>
        )}
      </div>
      {autoArmed ? (
        <p className="text-lg italic text-ink-mid">
          No button needed — hold the pint steady and level, and it snaps itself.
        </p>
      ) : (
        <button
          onClick={capture}
          disabled={status !== 'live'}
          className="h-24 w-24 rounded-full border-4 border-paper bg-ink shadow-[0_8px_30px_rgba(65,65,152,0.3)] transition active:scale-90 disabled:opacity-30"
          aria-label="Take photo"
        />
      )}
      <div className="flex items-center gap-8">
        {autoArmed && (
          <button
            onClick={capture}
            className="flabel underline decoration-ink-faint underline-offset-8"
          >
            snap manually
          </button>
        )}
        <button
          onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}
          className="flabel underline decoration-ink-faint underline-offset-8"
        >
          flip camera
        </button>
      </div>
    </div>
  )
}
