'use client'

import {useCallback, useEffect, useRef, useState} from 'react'
import Link from 'next/link'
import {Camera} from '@/components/Camera'
import {Brand, PourLoader} from '@/components/Brand'

type Player = {_id: string; name: string}

type Attempt = {
  _id: string
  status: string
  lastRejection?: string
  fullPintVerdict?: {banter?: string}
  splitVerdict?: {split: boolean; score: number; banter?: string; reason?: string}
}

type Phase = 'pickPlayer' | 'pickMode' | 'captureSplit' | 'judgingSplit' | 'result'

type Mode = 'splitG' | 'dropHarp'

const MODES: Record<Mode, {title: React.ReactNode; tagline: string; aim: string; win: string}> = {
  splitG: {
    title: (
      <>
        Split the <span className="split-g italic text-gold-bright">G</span>
      </>
    ),
    tagline: 'land the line through the heart of the G',
    aim: 'Aim for the heart of the G.',
    win: 'G split!',
  },
  dropHarp: {
    title: <>Drop the Harp</>,
    tagline: 'the old-school way — land it between the harp and the word',
    aim: 'Land it in the gap below the harp.',
    win: 'Harp dropped!',
  },
}

const goldButton =
  'rounded-full bg-gradient-to-b from-gold-bright to-gold px-10 py-5 text-2xl font-bold tracking-wide text-stout shadow-[0_8px_30px_rgba(200,164,77,0.25)] transition active:scale-95'

export default function Kiosk() {
  const [phase, setPhase] = useState<Phase>('pickPlayer')
  const [players, setPlayers] = useState<Player[]>([])
  const [player, setPlayer] = useState<Player | null>(null)
  const [mode, setMode] = useState<Mode>('splitG')
  const [newName, setNewName] = useState('')
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadPlayers = useCallback(async () => {
    const res = await fetch('/api/players')
    setPlayers(await res.json())
  }, [])

  useEffect(() => {
    loadPlayers()
  }, [loadPlayers])

  useEffect(
    () => () => {
      if (pollTimer.current) clearTimeout(pollTimer.current)
    },
    [],
  )

  // Poll the attempt until the judge function has written a verdict.
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
    async (photo: Blob) => {
      if (!player) return
      setPhase('judgingSplit')
      setNotice(null)
      const form = new FormData()
      form.append('playerId', player._id)
      form.append('mode', mode)
      form.append('photo', photo, 'split.jpg')
      const res = await fetch('/api/attempts', {method: 'POST', body: form})
      const {_id} = await res.json()
      setAttempt({_id, status: 'judgingSplit'})
      pollUntilJudged(_id)
    },
    [player, mode, pollUntilJudged],
  )

  const retakePhoto = useCallback(
    async (photo: Blob) => {
      if (!attempt) return
      setPhase('judgingSplit')
      setNotice(null)
      const form = new FormData()
      form.append('photo', photo, 'split.jpg')
      form.append('phase', 'split')
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
    loadPlayers()
  }, [loadPlayers])

  const addPlayer = useCallback(async () => {
    const name = newName.trim()
    if (!name) return
    const res = await fetch('/api/players', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({name}),
    })
    const created: Player = await res.json()
    setNewName('')
    setPlayer(created)
    setPhase('pickMode')
  }, [newName])

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center gap-10 px-6 py-10 text-center">
      <Brand compact={phase !== 'pickPlayer'} />

      {notice && phase !== 'result' && (
        <p className="max-w-xl text-xl italic leading-relaxed text-gold-bright sm:text-2xl">
          &ldquo;{notice}&rdquo;
        </p>
      )}

      {phase === 'pickPlayer' && (
        <section className="flex w-full flex-col items-center gap-10">
          <p className="text-3xl italic text-cream-dim">Who&apos;s up?</p>
          {players.length > 0 && (
            <div className="flex max-w-xl flex-wrap justify-center gap-3">
              {players.map((p) => (
                <button
                  key={p._id}
                  onClick={() => {
                    setPlayer(p)
                    setPhase('pickMode')
                  }}
                  className="rounded-full border border-gold/50 bg-stout-2/60 px-7 py-3 text-2xl text-cream transition active:bg-gold active:text-stout"
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex w-full max-w-md items-center gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
              placeholder="New challenger…"
              className="min-w-0 flex-1 rounded-full border border-cream/25 bg-stout-2/60 px-6 py-4 text-2xl italic text-cream outline-none placeholder:text-cream/30 focus:border-gold/70"
            />
            <button onClick={addPlayer} className={goldButton}>
              Join
            </button>
          </div>
          <Link
            href="/leaderboard"
            className="text-lg tracking-widest text-cream-dim underline decoration-gold/40 underline-offset-8"
          >
            view the leaderboard
          </Link>
        </section>
      )}

      {phase === 'pickMode' && player && (
        <section className="flex w-full max-w-xl flex-col items-center gap-8">
          <p className="text-3xl italic text-cream-dim">{player.name}, choose your challenge</p>
          <div className="flex w-full flex-col gap-4">
            {(Object.keys(MODES) as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m)
                  setPhase('captureSplit')
                }}
                className="flex flex-col items-center gap-1 rounded-3xl border border-gold/50 bg-stout-2/60 px-8 py-6 transition active:bg-gold/20"
              >
                <span className="text-4xl font-bold text-cream">{MODES[m].title}</span>
                <span className="text-lg italic text-cream-dim">{MODES[m].tagline}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {phase === 'judgingSplit' && (
        <PourLoader
          message={
            mode === 'dropHarp'
              ? 'The judge is studying the harp…'
              : 'The judge is studying the G…'
          }
        />
      )}

      {phase === 'captureSplit' && player && (
        <Camera
          label={`${player.name} — take your sip, then show the judge the ${
            mode === 'dropHarp' ? 'harp' : 'G'
          }`}
          phase="split"
          mode={mode}
          onCapture={(photo) => (attempt ? retakePhoto(photo) : startAttempt(photo))}
        />
      )}

      {phase === 'result' && attempt?.splitVerdict && (
        <section className="flex flex-col items-center gap-7 py-4">
          {attempt.splitVerdict.split ? (
            <p className="shimmer text-7xl font-bold sm:text-8xl">{MODES[mode].win}</p>
          ) : (
            <p className="text-6xl font-bold text-cream/70 sm:text-7xl">No split</p>
          )}
          <p className="text-5xl font-bold tabular-nums text-gold-bright sm:text-6xl">
            {attempt.splitVerdict.score.toFixed(2)}
            <span className="text-3xl text-cream-dim"> / 5.00</span>
          </p>
          {attempt.splitVerdict.split && (
            <p className="text-2xl tracking-widest text-cream-dim">+1 point on the board</p>
          )}
          {attempt.splitVerdict.banter && (
            <p className="max-w-xl text-xl italic leading-relaxed text-gold-bright sm:text-2xl">
              &ldquo;{attempt.splitVerdict.banter}&rdquo;
            </p>
          )}
          <button onClick={reset} className={`${goldButton} mt-2`}>
            Next challenger
          </button>
        </section>
      )}

      <footer className="mt-auto pt-8 text-sm uppercase tracking-[0.4em] text-cream/30">
        Sláinte &middot; Skål
      </footer>
    </main>
  )
}
