'use client'

import {useCallback, useEffect, useRef, useState} from 'react'
import type {CaptureGeometry, Detection} from '@/lib/detector'
import {scorePct} from '@/lib/score'

type CameraStatus = 'starting' | 'live' | 'error'

// The full-pint proof just needs a clear look at the glass; the split shot
// needs real aim. Tolerances scale with the G's on-screen size so distance
// from the camera doesn't change the difficulty.
const CAPTURE_TUNING = {
  full: {frames: 6, tolerance: (boxH: number) => Math.max(14, boxH * 0.45)},
  split: {frames: 10, tolerance: (boxH: number) => Math.max(10, boxH * 0.2)},
} as const

// Live viewfinder. Uses getUserMedia (requires HTTPS or localhost). Capture is
// detector-only: an in-browser YOLO model must lock onto the G and the beer
// line, and it snaps automatically once the player holds steady
// (docs/live-detection-spec.md). There is no manual shutter and no file
// upload — if the model can't see a real pint, no photo leaves the phone.
export function Camera({
  label,
  onCapture,
  mode = 'splitG',
  phase = 'split',
  withSelfie = true,
}: {
  label: string
  onCapture: (photo: Blob, geometry: CaptureGeometry | null, selfie?: Blob) => void
  mode?: 'splitG' | 'dropHarp'
  // 'full': auto-capture when the G logo is held steady (no line/score needed).
  // 'split': auto-capture when the beer line is held steady; shows live score.
  phase?: 'full' | 'split'
  // BeReal second shot after a split: flip to the front camera and grab the
  // drinker. Split shots only; degrades to pint-only if the front cam won't open.
  withSelfie?: boolean
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
  // null = loading, true = armed, false = model failed (retry re-arms)
  const [detectorReady, setDetectorReady] = useState<boolean | null>(null)
  const [detectorAttempt, setDetectorAttempt] = useState(0)
  const [loadPct, setLoadPct] = useState(0)
  // 'hunt' = finding the G, 'selfie' = the front-camera countdown after a split.
  const [stage, setStage] = useState<'hunt' | 'selfie'>('hunt')
  const [countdown, setCountdown] = useState<number | null>(null)
  const pendingRef = useRef<{blob: Blob; geometry: CaptureGeometry | null} | null>(null)
  const selfieRunRef = useRef(false)
  const doSelfie = phase === 'split' && withSelfie

  // Snap the current frame — but only if the detector has a full reading
  // (G box + beer line for split shots); otherwise report failure so the
  // loop keeps watching instead of submitting a blind photo.
  const capture = useCallback(async (): Promise<boolean> => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return false
    let geometry: CaptureGeometry | null = null
    if (phase === 'split') {
      if (!lastDetRef.current) return false
      const {toGeometry} = await import('@/lib/detector')
      geometry = toGeometry(lastDetRef.current, video.videoWidth, video.videoHeight)
      if (!geometry) return false
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    )
    if (!blob) return false
    // Split shots earn the BeReal second act: stash the pint, flip to the
    // front camera and grab the drinker. Everything else submits straight away.
    if (doSelfie) {
      pendingRef.current = {blob, geometry}
      setStage('selfie')
      return true
    }
    onCapture(blob, geometry)
    return true
  }, [onCapture, phase, doSelfie])

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

  // Live detection loop — the only path to a photo. Pauses during the selfie.
  useEffect(() => {
    if (status !== 'live' || stage !== 'hunt') return
    let stopped = false
    let zonePixels: typeof import('@/lib/detector').zonePixels | null = null
    let perfectZonePixels: typeof import('@/lib/detector').perfectZonePixels | null = null
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
        // Faint band = the scoring zone; stronger inner band = the full point.
        if (zonePixels) {
          const {top, bottom} = zonePixels(box, mode)
          ctx.fillStyle = 'rgba(224, 106, 69, 0.18)'
          ctx.fillRect(left, top, right - left, bottom - top)
        }
        if (perfectZonePixels) {
          const inner = perfectZonePixels(box, mode)
          if (inner) {
            ctx.fillStyle = 'rgba(224, 106, 69, 0.3)'
            ctx.fillRect(left, inner.top, right - left, inner.bottom - inner.top)
          }
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
        perfectZonePixels = mod.perfectZonePixels
      } catch (err) {
        console.error('Live detector failed to load:', err)
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
                if (await capture()) return
                // Incomplete reading (e.g. the line vanished at the last
                // moment) — back to watching.
                s.captured = false
                s.count = 0
              }
            } else {
              s.count = Math.max(0, s.count - 2)
              if (s.count === 0) s.last = null
              setHolding(false)
            }
          } catch (err) {
            console.error('Live detection stopped:', err)
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
  }, [mode, phase, status, capture, detectorAttempt, stage])

  // While the camera is live but the model is still loading, poll its download
  // progress for the in-frame warming bar.
  useEffect(() => {
    if (status !== 'live' || detectorReady !== null) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    import('@/lib/detector').then(({getLoadProgress}) => {
      const tick = () => {
        if (stopped) return
        setLoadPct(getLoadProgress())
        timer = setTimeout(tick, 200)
      }
      tick()
    })
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [status, detectorReady])

  // Submit whatever we have — the pint, plus a selfie if we got one.
  const finish = useCallback(
    (selfie: Blob | null) => {
      const p = pendingRef.current
      if (!p) return
      pendingRef.current = null
      onCapture(p.blob, p.geometry, selfie ?? undefined)
    },
    [onCapture],
  )

  const snapSelfie = useCallback(async () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return finish(null)
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    // Mirror to match the selfie preview the guest was just smiling into.
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
    finish(blob)
  }, [finish])

  // Selfie stage: flip to the front camera, give it a beat to open, then count
  // 3-2-1 and snap. Time-based (not status-driven) so it can't start counting
  // against the stale rear-camera frame. If the front camera never produces a
  // frame, snapSelfie falls back to submitting the pint alone.
  useEffect(() => {
    if (stage !== 'selfie' || selfieRunRef.current) return
    selfieRunRef.current = true
    setFacing('user')
    let n = 3
    const timers: ReturnType<typeof setTimeout>[] = []
    // ~1.1s for the front camera to open (and for them to turn the phone round).
    timers.push(
      setTimeout(() => {
        setCountdown(n)
        const id = setInterval(() => {
          n -= 1
          if (n > 0) {
            setCountdown(n)
          } else {
            clearInterval(id)
            setCountdown(null)
            snapSelfie()
          }
        }, 800)
        timers.push(id)
      }, 1100),
    )
    return () => timers.forEach((t) => clearTimeout(t))
  }, [stage, snapSelfie])

  if (status === 'error' && stage !== 'selfie') {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <p className="text-2xl italic text-ink-mid">{label}</p>
        <p className="text-lg text-coral">{errorDetail}</p>
        <p className="text-base text-ink-mid">
          The judge only accepts live shots straight from the camera — no photo, no verdict.
        </p>
        <button
          onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}
          className="flabel underline decoration-ink-faint underline-offset-8"
        >
          try the other camera
        </button>
      </div>
    )
  }

  const mirrored = facing === 'user' ? '-scale-x-100' : ''

  return (
    <div className="flex w-full flex-col items-center gap-7">
      <p className="max-w-lg text-center text-xl italic text-ink-mid sm:text-2xl">
        {stage === 'selfie' ? 'Now you — big smile for the wall!' : label}
      </p>
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
          className={`pointer-events-none absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] rounded-2xl object-cover ${mirrored} ${
            stage === 'selfie' ? 'opacity-0' : ''
          }`}
        />
        {stage === 'selfie' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {countdown != null ? (
              <span className="names text-[8rem] leading-none text-paper drop-shadow-[0_4px_20px_rgba(51,51,89,0.6)]">
                {countdown}
              </span>
            ) : (
              <span className="flabel rounded-full bg-paper/90 px-5 py-2 text-ink">say cheese…</span>
            )}
          </div>
        )}
        {status === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-ink-faint border-t-ink" />
            <p className="px-8 text-center text-xl italic text-ink-mid">
              Waiting for the camera… if the browser asks for permission, tap Allow.
            </p>
          </div>
        )}
        {/* Camera is live but the detector is still downloading — say so IN the
            frame, so the dead-looking feed reads as "not ready yet", not broken. */}
        {stage === 'hunt' && status === 'live' && detectorReady === null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl bg-paper/75 backdrop-blur-[2px]">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-ink-faint border-t-ink" />
            <p className="px-8 text-center text-xl italic text-ink-mid">
              Warming up the pint detector…
            </p>
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-ink-faint/60">
              <div
                className="h-full rounded-full bg-ink transition-[width] duration-200 ease-out"
                style={{width: `${Math.max(8, Math.round(loadPct * 100))}%`}}
              />
            </div>
            <p className="flabel">this only happens once</p>
          </div>
        )}
        {stage === 'hunt' && (liveScore != null || holding) && (
          <div className="absolute left-1/2 top-5 -translate-x-1/2 rounded-full bg-paper/90 px-5 py-2 text-2xl font-bold tabular-nums text-ink">
            {liveScore != null && `${scorePct(liveScore)}%`}
            {holding && (
              <span className={`italic text-ink-mid ${liveScore != null ? 'ml-3 text-base' : 'text-xl'}`}>
                hold it…
              </span>
            )}
          </div>
        )}
      </div>
      {stage === 'selfie' ? (
        <button
          onClick={() => finish(null)}
          className="flabel underline decoration-ink-faint underline-offset-8"
        >
          skip the selfie
        </button>
      ) : (
        <>
          {detectorReady === false ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="max-w-md text-lg text-coral">
                The pint-spotter couldn&apos;t start in this browser, and the judge only accepts
                photos it has seen the G in. Try reloading, or borrow a friend&apos;s phone.
              </p>
              <button onClick={() => setDetectorAttempt((n) => n + 1)} className="fbtn">
                try again
              </button>
            </div>
          ) : detectorReady ? (
            <p className="text-lg italic text-ink-mid">
              No button needed — hold the pint steady and level, and it snaps itself.
            </p>
          ) : null}
          <button
            onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}
            className="flabel underline decoration-ink-faint underline-offset-8"
          >
            flip camera
          </button>
        </>
      )}
    </div>
  )
}
