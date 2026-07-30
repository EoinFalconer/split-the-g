'use client'

import {useCallback, useState} from 'react'
import Link from 'next/link'

// Get the story card onto the phone: native share sheet (→ Instagram story) on
// mobile, a download everywhere else, with a copy-link fallback.
export function ShareActions({id, playerName}: {id: string; playerName: string}) {
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const cardUrl = `/api/share/${id}`

  const fetchCard = useCallback(async () => {
    const res = await fetch(cardUrl)
    if (!res.ok) throw new Error('card not ready')
    return res.blob()
  }, [cardUrl])

  const share = useCallback(async () => {
    setBusy(true)
    try {
      const blob = await fetchCard()
      const file = new File([blob], `split-the-g-${playerName}.png`, {type: 'image/png'})
      const nav = navigator as Navigator & {canShare?: (d: {files: File[]}) => boolean}
      if (nav.canShare?.({files: [file]})) {
        await navigator.share({
          files: [file],
          title: 'Split the G',
          text: `${playerName}'s pint — split-the-g.eoin.no`,
        })
      } else {
        // desktop / unsupported — download instead
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = file.name
        link.click()
        URL.revokeObjectURL(url)
      }
    } catch {
      // sharing cancelled or failed — no-op
    } finally {
      setBusy(false)
    }
  }, [fetchCard, playerName])

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard blocked — the URL is on screen anyway
    }
  }, [])

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4">
      <button onClick={share} disabled={busy} className="fbtn w-full">
        {busy ? 'getting it ready…' : 'share to your story'}
      </button>
      <button onClick={copyLink} className="flabel underline decoration-ink-faint underline-offset-8">
        {copied ? 'link copied!' : 'copy link'}
      </button>
      <Link href="/" className="flabel underline decoration-ink-faint underline-offset-8">
        back to the feed
      </Link>
    </div>
  )
}
