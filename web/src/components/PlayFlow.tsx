'use client'

import {useCallback, useEffect, useRef, useState} from 'react'
import Link from 'next/link'
import {Camera} from '@/components/Camera'
import {Brand, PintsSign, PourLoader} from '@/components/Brand'
import type {CaptureGeometry} from '@/lib/detector'
import {lookupVenue} from '@/lib/venue'
import {scorePct, perfectLabel, fmtPoints} from '@/lib/score'
import {ZoneDiagram} from '@/components/ZoneDiagram'
import type {EventConfig} from '@/lib/event'

type Player = {_id: string; name: string}

type Attempt = {
  _id: string
  status: string
  lastRejection?: string
  fullPintVerdict?: {banter?: string}
  splitVerdict?: {split: boolean; points?: number; score: number; banter?: string; reason?: string}
}

type Phase = 'welcome' | 'pickPlayer' | 'pickMode' | 'captureSplit' | 'judgingSplit' | 'result'

type Mode = 'splitG' | 'dropHarp'

const MODES: Record<
  Mode,
  {title: React.ReactNode; tagline: string; aim: string; win: string; miss: string; perfect: string}
> = {
  splitG: {
    title: (
      <>
        Split the <span className="split-g">G</span>
      </>
    ),
    tagline: 'middle of the G = 1 point · elsewhere on the G = ½ point',
    aim: 'Aim for the heart of the G.',
    win: 'G split!',
    miss: 'No split',
    perfect:
      'Through the middle of the G (a little leeway allowed) = 1 point. Anywhere else on the G = ½ point. Off the G = nothing. The % is how close to dead centre you came.',
  },
  dropHarp: {
    title: <>Drop the Harp</>,
    tagline: 'the old-school way — the gap below the harp: 1 point or nothing',
    aim: 'Land it in the gap below the harp.',
    win: 'Harp dropped!',
    miss: 'Harp still standing',
    perfect:
      'All or nothing: land the line in the gap between the harp and the word for the full point. The % is how close to dead centre of the gap you came.',
  },
}

const INTRO_SEEN_KEY = 'stg-intro-seen'
// The pub/venue this browser last posted from — auto-tags the next pints.
const VENUE_KEY = 'stg-venue'

const HOW_TO_STEPS: {title: string; body: string}[] = [
  {title: 'Get a pint', body: 'Collect a fresh pint of Guinness from the bar. One attempt per pint.'},
  {title: 'Pick your name', body: 'Find yourself on the list (or join in) so your score lands on the board.'},
  {title: 'Take your sip', body: 'One honest gulp — you’re aiming to leave the beer line right in the middle of the G on the glass.'},
  {title: 'Show the camera', body: 'Hold the glass up with the G facing the camera and keep it steady — it snaps by itself. And keep it level: the judge disqualifies tilted pints.'},
  {title: 'Face the judge', body: 'Claude rules on every pint. A clean hit is a point on the board — most points by the end of the night takes the championship.'},
  {title: 'The score', body: 'Split the G: line through the middle of the G (a little leeway) = 1 point, anywhere else on the G = ½ point, off the G = nothing. Drop the Harp is all or nothing: the gap below the harp = 1 point. The percentage just brags how close to dead centre you came.'},
]

export function PlayFlow({event}: {event: EventConfig}) {
  const feedHref = `/e/${event.slug}`
  const boardHref = `/e/${event.slug}/leaderboard`
  // Remembered player is per-event, so an event-A name never autofills in B.
  const playerKey = `stg-player-${event.slug}`

  const [phase, setPhase] = useState<Phase>('pickPlayer')
  const [players, setPlayers] = useState<Player[]>([])
  const [player, setPlayer] = useState<Player | null>(null)
  const [mode, setMode] = useState<Mode>('splitG')
  const [newName, setNewName] = useState('')
  const [remembered, setRemembered] = useState<Player | null>(null)
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [venue, setVenue] = useState('')
  const [postState, setPostState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [locating, setLocating] = useState(false)
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!window.localStorage.getItem(INTRO_SEEN_KEY)) setPhase('welcome')
    try {
      const saved = window.localStorage.getItem(playerKey)
      if (saved) setRemembered(JSON.parse(saved))
    } catch {
      // corrupt value — ignore and ask for a name
    }
    setVenue(window.localStorage.getItem(VENUE_KEY) ?? '')
    // Warm the detector now, while they pick a name and challenge.
    import('@/lib/detector')
      .then((m) => m.loadDetector())
      .catch(() => {
        // the camera screen will surface the failure and offer a retry
      })
  }, [playerKey])

  const navigate = useCallback((next: Phase) => {
    window.history.pushState({stg: next}, '')
    setPhase(next)
  }, [])

  const choosePlayer = useCallback(
    (p: Player) => {
      window.localStorage.setItem(playerKey, JSON.stringify(p))
      setRemembered(p)
      setPlayer(p)
      navigate('pickMode')
    },
    [navigate, playerKey],
  )

  const dismissIntro = useCallback(() => {
    window.localStorage.setItem(INTRO_SEEN_KEY, '1')
    navigate('pickPlayer')
  }, [navigate])

  const loadPlayers = useCallback(async () => {
    const res = await fetch(`/api/players${event.id ? `?event=${event.id}` : ''}`)
    setPlayers(await res.json())
  }, [event.id])

  useEffect(() => {
    loadPlayers()
  }, [loadPlayers])

  useEffect(
    () => () => {
      if (pollTimer.current) clearTimeout(pollTimer.current)
    },
    [],
  )

  const pollUntilJudged = useCallback((attemptId: string) => {
    const tick = async () => {
      try {
        const res = await fetch(`/api/attempts/${attemptId}`)
        if (res.ok) {
          const data: Attempt = await res.json()
          setAttempt(data)
          if (data.status === 'retakeSplit') {
            setNotice(data.lastRejection ?? 'The judge needs to see the G. Try again.')
            setPhase('captureSplit')
            return
          }
          if (data.status === 'scored') {
            setPhase('result')
            return
          }
        }
      } catch {
        // network blip at the bar — keep polling
      }
      pollTimer.current = setTimeout(tick, 1500)
    }
    tick()
  }, [])

  const startAttempt = useCallback(
    async (photo: Blob, geometry: CaptureGeometry | null, selfie?: Blob) => {
      if (!player) return
      setPhase('judgingSplit')
      setNotice(null)
      const form = new FormData()
      form.append('playerId', player._id)
      form.append('mode', mode)
      form.append('photo', photo, 'split.jpg')
      if (geometry) form.append('geometry', JSON.stringify(geometry))
      if (selfie) form.append('selfie', selfie, 'selfie.jpg')
      if (event.id) form.append('eventId', event.id)
      const savedVenue = window.localStorage.getItem(VENUE_KEY)?.trim()
      if (savedVenue) form.append('venue', savedVenue)
      const res = await fetch('/api/attempts', {method: 'POST', body: form})
      const {_id} = await res.json()
      setAttempt({_id, status: 'judgingSplit'})
      pollUntilJudged(_id)
    },
    [player, mode, event.id, pollUntilJudged],
  )

  const retakePhoto = useCallback(
    async (photo: Blob, geometry: CaptureGeometry | null, selfie?: Blob) => {
      if (!attempt) return
      setPhase('judgingSplit')
      setNotice(null)
      const form = new FormData()
      form.append('photo', photo, 'split.jpg')
      form.append('phase', 'split')
      if (geometry) form.append('geometry', JSON.stringify(geometry))
      if (selfie) form.append('selfie', selfie, 'selfie.jpg')
      await fetch(`/api/attempts/${attempt._id}/photo`, {method: 'POST', body: form})
      pollUntilJudged(attempt._id)
    },
    [attempt, pollUntilJudged],
  )

  const reset = useCallback(() => {
    setPhase('pickPlayer')
    setPlayer(null)
    setAttempt(null)
    setNotice(null)
    setCaption('')
    setPostState('idle')
    loadPlayers()
  }, [loadPlayers])

  const savePost = useCallback(async () => {
    if (!attempt) return
    setPostState('saving')
    window.localStorage.setItem(VENUE_KEY, venue.trim())
    try {
      const res = await fetch(`/api/attempts/${attempt._id}/post`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({caption: caption.trim(), venue: venue.trim()}),
      })
      if (!res.ok) throw new Error(`post failed: ${res.status}`)
      setPostState('saved')
    } catch {
      setPostState('failed')
    }
  }, [attempt, caption, venue])

  const locate = useCallback(async () => {
    setLocating(true)
    const found = await lookupVenue()
    if (found) {
      setVenue(found)
      setPostState('idle')
    }
    setLocating(false)
  }, [])

  const phaseRef = useRef(phase)
  phaseRef.current = phase
  useEffect(() => {
    const onPop = () => {
      switch (phaseRef.current) {
        case 'pickMode':
          setPhase('pickPlayer')
          break
        case 'captureSplit':
          setAttempt(null)
          setNotice(null)
          setPhase('pickMode')
          break
        case 'judgingSplit':
        case 'result':
          reset()
          break
        default:
          break
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [reset])

  const addPlayer = useCallback(async () => {
    const name = newName.trim()
    if (!name) return
    const res = await fetch('/api/players', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({name, eventId: event.id}),
    })
    const created: Player = await res.json()
    setNewName('')
    choosePlayer(created)
  }, [newName, choosePlayer, event.id])

  const query = newName.trim().toLowerCase()
  const shownPlayers = query
    ? players.filter((p) => p.name.toLowerCase().includes(query))
    : players

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center gap-8 px-5 py-8 text-center">
      <Brand event={event} compact={phase !== 'pickPlayer' && phase !== 'welcome'} />

      {notice && phase !== 'result' && (
        <p className="max-w-xl text-xl italic leading-relaxed text-coral sm:text-2xl">
          &ldquo;{notice}&rdquo;
        </p>
      )}

      {phase === 'welcome' && (
        <section className="flex w-full max-w-xl flex-col items-center gap-7">
          <p className="max-w-md text-lg leading-relaxed text-ink-deep">
            Welcome to the table game of the night. It&apos;s played with a pint of Guinness, one
            brave sip, and an incorruptible judge.
          </p>
          <div className="flex w-full flex-col gap-3 text-left">
            {HOW_TO_STEPS.map((step, i) => (
              <div key={step.title} className="card flex items-start gap-4">
                <span className="names shrink-0 text-3xl text-coral">{i + 1}</span>
                <div>
                  <p className="flabel">{step.title}</p>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink-deep">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={dismissIntro} className="fbtn">
            grand, let&apos;s pour
          </button>
          <Link href={boardHref} className="flabel underline decoration-ink-faint underline-offset-8">
            peek at the leaderboard
          </Link>
        </section>
      )}

      {phase === 'pickPlayer' && (
        <section className="flex w-full flex-col items-center gap-8">
          {remembered ? (
            <>
              <p className="names text-4xl text-ink-mid">Back for another?</p>
              <button onClick={() => choosePlayer(remembered)} className="fbtn">
                continue as {remembered.name}
              </button>
              <button
                onClick={() => setRemembered(null)}
                className="flabel underline decoration-ink-faint underline-offset-8"
              >
                not {remembered.name}? pick a name
              </button>
            </>
          ) : (
            <>
              <p className="names text-4xl text-ink-mid">Who&apos;s up?</p>
              <div className="flex w-full max-w-md items-center gap-3">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
                  placeholder="Find or enter your name…"
                  className="min-w-0 flex-1 rounded-full border-[1.5px] border-ink-faint bg-white/45 px-6 py-3.5 text-lg text-ink-deep outline-none placeholder:text-ink-soft focus:border-ink"
                />
              </div>
              {shownPlayers.length > 0 && (
                <div className="flex max-w-xl flex-wrap justify-center gap-3">
                  {shownPlayers.map((p) => (
                    <button
                      key={p._id}
                      onClick={() => choosePlayer(p)}
                      className="rounded-full border-[1.5px] border-ink-faint bg-white/45 px-6 py-2.5 text-lg font-semibold text-ink-deep transition active:border-ink active:bg-wash"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
              {newName.trim() && (
                <button onClick={addPlayer} className="fbtn">
                  join as &ldquo;{newName.trim()}&rdquo;
                </button>
              )}
            </>
          )}
          <div className="flex items-center gap-8">
            <Link href={feedHref} className="flabel underline decoration-ink-faint underline-offset-8">
              the feed
            </Link>
            <Link href={boardHref} className="flabel underline decoration-ink-faint underline-offset-8">
              the leaderboard
            </Link>
            <button
              onClick={() => navigate('welcome')}
              className="flabel underline decoration-ink-faint underline-offset-8"
            >
              how to play
            </button>
          </div>
        </section>
      )}

      {phase === 'pickMode' && player && (
        <section className="flex w-full max-w-xl flex-col items-center gap-8">
          <p className="names text-4xl text-ink-mid">{player.name}, choose your challenge</p>
          <button
            onClick={() => window.history.back()}
            className="flabel underline decoration-ink-faint underline-offset-8"
          >
            &larr; not {player.name}? back to the names
          </button>
          <div className="flex w-full flex-col gap-4">
            {(Object.keys(MODES) as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m)
                  navigate('captureSplit')
                }}
                className="optcard"
              >
                <span className="flex items-center gap-5 text-left">
                  <ZoneDiagram mode={m} className="h-28 w-auto shrink-0" />
                  <span className="min-w-0">
                    <span className="names block text-4xl text-ink">{MODES[m].title}</span>
                    <span className="mt-1 block text-[15px] italic text-ink-mid">{MODES[m].tagline}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {phase === 'judgingSplit' && (
        <PourLoader
          message={mode === 'dropHarp' ? 'The judge is studying the harp…' : 'The judge is studying the G…'}
        />
      )}

      {phase === 'captureSplit' && player && (
        <Camera
          label={`${player.name} — take your sip, then show the judge the ${
            mode === 'dropHarp' ? 'harp' : 'G'
          }. Keep the glass level!`}
          phase="split"
          mode={mode}
          onCapture={(photo, geometry, selfie) =>
            attempt ? retakePhoto(photo, geometry, selfie) : startAttempt(photo, geometry, selfie)
          }
        />
      )}
      {phase === 'captureSplit' && player && (
        <button
          onClick={() => (attempt ? reset() : window.history.back())}
          className="flabel underline decoration-ink-faint underline-offset-8"
        >
          {attempt ? 'start over with a fresh pint' : '← change challenge'}
        </button>
      )}

      {phase === 'result' && attempt?.splitVerdict && (
        <section className="flex flex-col items-center gap-7 py-4">
          {attempt.splitVerdict.split ? (
            <p className="names shimmer text-7xl sm:text-8xl">{MODES[mode].win}</p>
          ) : (
            <p className="names text-6xl text-ink-soft sm:text-7xl">{MODES[mode].miss}</p>
          )}
          <div className="flex flex-col items-center gap-2">
            <p className="text-6xl font-bold tabular-nums text-ink sm:text-7xl">
              {scorePct(attempt.splitVerdict.score)}
              <span className="text-4xl font-normal text-ink-soft">%</span>
              <span className="ml-3 text-xl font-normal italic text-ink-mid">{perfectLabel(mode)}</span>
            </p>
            <p className="max-w-sm text-sm leading-relaxed text-ink-mid">{MODES[mode].perfect}</p>
          </div>
          {(() => {
            const v = attempt.splitVerdict
            const pts = v.points ?? (v.split ? 1 : 0)
            if (pts === 0) return null
            return (
              <p className="flabel text-coral">
                +{fmtPoints(pts)} point{pts > 1 ? 's' : ''} on the board
                {pts === 0.5 && ' — on the G, not the middle'}
              </p>
            )
          })()}
          {attempt.splitVerdict.banter && (
            <p className="max-w-xl text-xl italic leading-relaxed text-coral sm:text-2xl">
              &ldquo;{attempt.splitVerdict.banter}&rdquo;
            </p>
          )}
          <div className="card flex w-full max-w-md flex-col gap-3">
            <p className="flabel">your post, your words</p>
            <input
              value={caption}
              onChange={(e) => {
                setCaption(e.target.value)
                setPostState('idle')
              }}
              maxLength={140}
              placeholder="write a caption…"
              className="w-full rounded-full border-[1.5px] border-ink-faint bg-white/45 px-5 py-2.5 text-base text-ink-deep outline-none placeholder:text-ink-soft focus:border-ink"
            />
            <div className="flex items-center gap-2">
              <input
                value={venue}
                onChange={(e) => {
                  setVenue(e.target.value)
                  setPostState('idle')
                }}
                maxLength={80}
                placeholder="the pub you're in"
                className="min-w-0 flex-1 rounded-full border-[1.5px] border-ink-faint bg-white/45 px-5 py-2.5 text-base text-ink-deep outline-none placeholder:text-ink-soft focus:border-ink"
              />
              <button
                onClick={locate}
                disabled={locating}
                title="Use my location"
                className="shrink-0 rounded-full border-[1.5px] border-ink-faint bg-white/45 px-4 py-2.5 text-base transition active:border-ink disabled:opacity-50"
              >
                {locating ? '…' : '📍'}
              </button>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={savePost}
                disabled={postState === 'saving' || postState === 'saved'}
                className="fbtn fbtn-sm self-start"
              >
                {postState === 'saved' ? 'on the feed ✓' : postState === 'saving' ? 'posting…' : 'post it'}
              </button>
              {postState === 'failed' && (
                <span className="text-sm text-coral">didn&apos;t save — try again</span>
              )}
            </div>
          </div>
          {attempt._id && (
            <Link href={`/share/${attempt._id}`} className="fbtn fbtn-outline mt-2">
              share your pint
            </Link>
          )}
          <button onClick={reset} className="fbtn">
            Next challenger
          </button>
          <Link href={feedHref} className="flabel underline decoration-ink-faint underline-offset-8">
            see it on the feed
          </Link>
        </section>
      )}

      <footer className="mt-auto pt-8">
        <PintsSign signoff={event.signoff} />
      </footer>
    </main>
  )
}
