'use client'

import {useState} from 'react'
import Link from 'next/link'
import {THEME_PRESETS, eventUrl, themeVars} from '@/lib/event'

type Created = {slug: string; name: string; themeKey: string}

const PRESET_KEYS = Object.keys(THEME_PRESETS)

export default function NewEvent() {
  const [name, setName] = useState('')
  const [kicker, setKicker] = useState('')
  const [dateLabel, setDateLabel] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [signoff, setSignoff] = useState('')
  const [themeKey, setThemeKey] = useState('classic')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Created | null>(null)

  const submit = async () => {
    if (!name.trim()) {
      setError('Give your event a name')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          name: name.trim(),
          kicker: kicker.trim(),
          dateLabel: dateLabel.trim(),
          signoff: signoff.trim(),
          theme: themeKey,
          // datetime-local is local time; store as ISO for the window.
          startsAt: startsAt ? new Date(startsAt).toISOString() : '',
          endsAt: endsAt ? new Date(endsAt).toISOString() : '',
          championshipLabel: 'the main event',
          practiceLabel: 'warm-up',
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Could not create the event')
      const {slug} = await res.json()
      setCreated({slug, name: name.trim(), themeKey})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  if (created) {
    const url = eventUrl(created.slug)
    return (
      <main
        className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center gap-7 px-5 py-12 text-center"
        style={themeVars(THEME_PRESETS[created.themeKey]) as React.CSSProperties}
      >
        <p className="hello">it&apos;s poured</p>
        <h1 className="names text-5xl">
          {created.name} is <span className="split-g">live</span>
        </h1>
        <p className="max-w-sm text-ink-deep">
          Print this QR for the table, or share the link. Guests scan it, pick a name, and start
          splitting.
        </p>

        <div className="flex flex-col items-center gap-3 rounded-2xl border-[1.5px] border-ink-faint bg-white/45 p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/events/${created.slug}/qr`}
            alt={`QR code for ${created.name}`}
            className="h-56 w-56"
          />
          <p className="text-lg font-bold text-ink">{url.replace(/^https?:\/\//, '')}</p>
          <div className="flex gap-4">
            <a
              href={`/api/events/${created.slug}/qr?format=svg`}
              download={`${created.slug}-qr.svg`}
              className="flabel underline decoration-ink-faint underline-offset-8"
            >
              download QR
            </a>
            <button
              onClick={() => navigator.clipboard?.writeText(url)}
              className="flabel underline decoration-ink-faint underline-offset-8"
            >
              copy link
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Link href={`/e/${created.slug}`} className="fbtn">
            open the feed
          </Link>
          <Link
            href={`/e/${created.slug}/play`}
            className="flabel underline decoration-ink-faint underline-offset-8"
          >
            pour the first pint
          </Link>
        </div>
      </main>
    )
  }

  const preview = THEME_PRESETS[themeKey]
  return (
    <main
      className="mx-auto flex min-h-screen w-full max-w-lg flex-col gap-6 px-5 py-12"
      style={themeVars(preview) as React.CSSProperties}
    >
      <header className="flex flex-col items-center gap-1 text-center">
        <h1 className="names text-5xl">
          Start your <span className="split-g">G</span>
        </h1>
        <p className="flabel mt-1">a Split the G championship, in a minute</p>
      </header>

      <label className="flex flex-col gap-1.5">
        <span className="flabel">Event name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Dave's Stag"
          className="rounded-full border-[1.5px] border-ink-faint bg-white/45 px-5 py-3 text-lg text-ink-deep outline-none placeholder:text-ink-soft focus:border-ink"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="flabel">Championship line (optional)</span>
        <input
          value={kicker}
          onChange={(e) => setKicker(e.target.value)}
          maxLength={60}
          placeholder="the stag championship"
          className="rounded-full border-[1.5px] border-ink-faint bg-white/45 px-5 py-3 text-base text-ink-deep outline-none placeholder:text-ink-soft focus:border-ink"
        />
      </label>

      <div>
        <span className="flabel">Colour</span>
        <div className="mt-2 flex flex-wrap gap-3">
          {PRESET_KEYS.map((key) => {
            const p = THEME_PRESETS[key]
            const on = key === themeKey
            return (
              <button
                key={key}
                onClick={() => setThemeKey(key)}
                className={`flex items-center gap-2 rounded-full border-[1.5px] px-4 py-2 text-sm transition ${
                  on ? 'border-ink bg-wash' : 'border-ink-faint bg-white/45'
                }`}
              >
                <span className="h-4 w-4 rounded-full" style={{background: p.ink}} />
                <span className="h-4 w-4 rounded-full" style={{background: p.coral}} />
                <span className="text-ink-deep">{p.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="flabel">Starts (optional)</span>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="rounded-xl border-[1.5px] border-ink-faint bg-white/45 px-4 py-2.5 text-sm text-ink-deep outline-none focus:border-ink"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="flabel">Ends (optional)</span>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="rounded-xl border-[1.5px] border-ink-faint bg-white/45 px-4 py-2.5 text-sm text-ink-deep outline-none focus:border-ink"
          />
        </label>
      </div>
      <p className="-mt-3 text-xs text-ink-soft">
        Set a window and the board splits into the main event vs warm-up. Leave blank for one
        running leaderboard.
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="flabel">Date label (optional)</span>
        <input
          value={dateLabel}
          onChange={(e) => setDateLabel(e.target.value)}
          maxLength={40}
          placeholder="12 August 2026"
          className="rounded-full border-[1.5px] border-ink-faint bg-white/45 px-5 py-3 text-base text-ink-deep outline-none placeholder:text-ink-soft focus:border-ink"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="flabel">Sign-off (optional)</span>
        <input
          value={signoff}
          onChange={(e) => setSignoff(e.target.value)}
          maxLength={60}
          placeholder="last one standing • buys the round"
          className="rounded-full border-[1.5px] border-ink-faint bg-white/45 px-5 py-3 text-base text-ink-deep outline-none placeholder:text-ink-soft focus:border-ink"
        />
      </label>

      {error && <p className="text-center text-coral">{error}</p>}

      <button onClick={submit} disabled={busy} className="fbtn mt-2">
        {busy ? 'pouring…' : 'create the event'}
      </button>
      <Link href="/" className="flabel text-center underline decoration-ink-faint underline-offset-8">
        back
      </Link>
    </main>
  )
}
