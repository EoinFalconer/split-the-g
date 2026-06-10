'use client'

import {useCallback, useEffect, useRef, useState} from 'react'

type CameraStatus = 'starting' | 'live' | 'error'

// Live viewfinder for the bar-top iPad. Uses getUserMedia (requires HTTPS or
// localhost); falls back to a native file input if the camera is unavailable.
export function Camera({
  label,
  onCapture,
}: {
  label: string
  onCapture: (photo: Blob) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>('starting')
  const [errorDetail, setErrorDetail] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setErrorDetail('This browser does not support camera access.')
      return
    }
    navigator.mediaDevices
      .getUserMedia({video: {facingMode: 'environment'}, audio: false})
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
    }
  }, [])

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
        {fileFallback}
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col items-center gap-7">
      <p className="max-w-lg text-center text-2xl italic text-cream-dim sm:text-3xl">{label}</p>
      <div className="relative w-full max-w-md rounded-3xl border border-gold/60 p-2 shadow-[0_0_60px_rgba(200,164,77,0.12)]">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedData={() => setStatus('live')}
          className="aspect-[3/4] w-full rounded-2xl border border-cream/15 object-cover"
        />
        {status === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-cream/20 border-t-gold" />
            <p className="px-8 text-center text-xl italic text-cream/80">
              Waiting for the camera… if the browser asks for permission, tap Allow.
            </p>
          </div>
        )}
      </div>
      <button
        onClick={capture}
        disabled={status !== 'live'}
        className="h-24 w-24 rounded-full border-4 border-cream/70 bg-gradient-to-b from-gold-bright to-gold shadow-[0_8px_30px_rgba(200,164,77,0.35)] transition active:scale-90 disabled:opacity-30"
        aria-label="Take photo"
      />
    </div>
  )
}
