'use client'

import {useCallback, useEffect, useRef, useState} from 'react'
import type {Detection} from '@/lib/detector'

type CameraStatus = 'starting' | 'live' | 'error'

const LIVE_DETECTOR = process.env.NEXT_PUBLIC_LIVE_DETECTOR === '1'
const STABLE_FRAMES_TO_CAPTURE = 16 // ~2s at ~8fps
const LINE_TOLERANCE_PX = 10

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
  onCapture: (photo: Blob) => void
  mode?: 'splitG' | 'dropHarp'
  // 'full': auto-capture when the G logo is held steady (no line/score needed).
  // 'split': auto-capture when the beer line is held steady; shows live score.
  phase?: 'full' | 'split'
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const stableRef = useRef({count: 0, last: null as number | null, captured: false})
  const [status, setStatus] = useState<CameraStatus>('starting')
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  // Kiosk default: the player faces the screen, so use the front camera.
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [liveScore, setLiveScore] = useState<number | null>(null)
  const [holding, setHolding] = useState(false)
  // null = loading/not applicable, true = auto-capture armed, false = model failed
  const [detectorReady, setDetectorReady] = useState<boolean | null>(null)

  const capture = useCallback(() => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob)
      },
      'image/jpeg',
      0.85,
    )
  }, [onCapture])

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
      ctx.strokeStyle = '#e8cf8d'
      ctx.lineWidth = Math.max(3, canvas.width / 200)
      ctx.strokeRect(box.x, box.y, box.w, box.h)
      if (phase === 'split' && lineY != null) {
        ctx.strokeStyle = det.hit ? '#7ddf8a' : '#f4ecdb'
        ctx.beginPath()
        ctx.moveTo(Math.max(0, box.x - box.w), lineY)
        ctx.lineTo(Math.min(canvas.width, box.x + box.w * 2), lineY)
        ctx.stroke()
      }
    }

    const run = async () => {
      let detect: typeof import('@/lib/detector').detect
      try {
        const mod = await import('@/lib/detector')
        await mod.loadDetector()
        detect = mod.detect
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
            draw(det)
            setLiveScore(phase === 'split' ? (det?.score ?? null) : null)
            // Stability signal: the beer line for split shots, the G box
            // position for the full-pint proof (a full pint's line sits far
            // above the logo, outside the line-finder's band).
            const signal =
              phase === 'split' ? (det?.lineY ?? null) : det ? det.box.y + det.box.h / 2 : null
            const s = stableRef.current
            if (signal != null) {
              const stable = s.last != null && Math.abs(signal - s.last) < LINE_TOLERANCE_PX
              s.count = stable ? s.count + 1 : 0
              s.last = signal
              setHolding(s.count >= STABLE_FRAMES_TO_CAPTURE / 2)
              if (s.count >= STABLE_FRAMES_TO_CAPTURE && !s.captured) {
                s.captured = true
                capture()
                return
              }
            } else {
              s.count = 0
              s.last = null
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
    <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-cream/40 px-6 py-4 text-xl">
      Take a photo with the device camera instead
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="text-base"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onCapture(file)
        }}
      />
    </label>
  )

  if (status === 'error') {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <p className="text-3xl">{label}</p>
        <p className="text-xl text-gold">{errorDetail}</p>
        <button
          onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}
          className="text-base uppercase tracking-[0.3em] text-cream/40 underline-offset-8 active:underline"
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
      <p className="max-w-lg text-center text-2xl italic text-cream-dim sm:text-3xl">{label}</p>
      <div className="relative w-full max-w-md rounded-3xl border border-gold/60 p-2 shadow-[0_0_60px_rgba(200,164,77,0.12)]">
        {/* Mirror the front-camera preview like a mirror; captures stay unmirrored */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedData={() => setStatus('live')}
          className={`aspect-[3/4] w-full rounded-2xl border border-cream/15 object-cover ${mirrored}`}
        />
        <canvas
          ref={overlayRef}
          className={`pointer-events-none absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] rounded-2xl object-cover ${mirrored}`}
        />
        {status === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-cream/20 border-t-gold" />
            <p className="px-8 text-center text-xl italic text-cream/80">
              Waiting for the camera… if the browser asks for permission, tap Allow.
            </p>
          </div>
        )}
        {(liveScore != null || holding) && (
          <div className="absolute left-1/2 top-5 -translate-x-1/2 rounded-full bg-stout/80 px-5 py-2 text-2xl font-bold tabular-nums text-gold-bright">
            {liveScore != null && liveScore.toFixed(2)}
            {holding && (
              <span className={`italic text-cream-dim ${liveScore != null ? 'ml-3 text-base' : 'text-xl'}`}>
                hold it…
              </span>
            )}
          </div>
        )}
      </div>
      {autoArmed ? (
        <p className="text-xl italic text-cream-dim">
          No button needed — hold the pint steady and it snaps itself.
        </p>
      ) : (
        <button
          onClick={capture}
          disabled={status !== 'live'}
          className="h-24 w-24 rounded-full border-4 border-cream/70 bg-gradient-to-b from-gold-bright to-gold shadow-[0_8px_30px_rgba(200,164,77,0.35)] transition active:scale-90 disabled:opacity-30"
          aria-label="Take photo"
        />
      )}
      <div className="flex items-center gap-8">
        {autoArmed && (
          <button
            onClick={capture}
            className="text-base uppercase tracking-[0.3em] text-cream/40 underline-offset-8 active:underline"
          >
            snap manually
          </button>
        )}
        <button
          onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}
          className="text-base uppercase tracking-[0.3em] text-cream/40 underline-offset-8 active:underline"
        >
          flip camera
        </button>
      </div>
    </div>
  )
}
