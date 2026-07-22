'use client'

import {useEffect, useState} from 'react'
import Link from 'next/link'
import {PintsSign} from '@/components/Brand'
import {BottomNav} from '@/components/Nav'
import {weddingDayStarted, type Board} from '@/lib/wedding'

type Row = {
  _id: string
  name: string
  gs: number
  harps: number
  points: number
  attempts: number
  best: number | null
}

type Latest = {
  playerName: string
  mode: string
  splitVerdict: {split: boolean; score: number; banter?: string}
} | null

type Geometry = {
  boxX?: number
  boxY?: number
  boxW?: number
  boxH?: number
  lineYNorm?: number
}

type Recent = {
  _id: string
  playerName: string
  mode: string
  img: string
  split: boolean
  score: number | null
  localGeometry: Geometry | null
}

const pct = (n: number) => `${(n * 100).toFixed(2)}%`

function PintCard({a}: {a: Recent}) {
  const g = a.localGeometry
  const hasBox =
    g != null && g.boxX != null && g.boxY != null && g.boxW != null && g.boxH != null
  return (
    <figure className="mb-3 inline-block w-full break-inside-avoid overflow-hidden rounded-2xl border-[1.5px] border-ink-faint bg-white/45">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${a.img}?w=500&auto=format`} alt="" className="block h-auto w-full" />
        {hasBox && (
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute rounded-sm border-2 border-ink-soft"
              style={{left: pct(g!.boxX!), top: pct(g!.boxY!), width: pct(g!.boxW!), height: pct(g!.boxH!)}}
            />
            {g!.lineYNorm != null && (
              <div
                className={`absolute left-0 right-0 ${a.split ? 'bg-coral' : 'bg-paper'}`}
                style={{top: pct(g!.lineYNorm), height: '2px'}}
              />
            )}
          </div>
        )}
        <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-ink-deep via-ink-deep/60 to-transparent px-3 pb-2 pt-6 text-sm">
          <span className="font-bold text-paper">{a.playerName}</span>
          <span className={`tabular-nums ${a.split ? 'text-coral-soft' : 'text-paper/60'}`}>
            {a.split ? (a.mode === 'dropHarp' ? 'harp' : 'split') : 'miss'}
            {a.score != null && ` · ${a.score.toFixed(2)}`}
          </span>
        </figcaption>
      </div>
    </figure>
  )
}

export default function Leaderboard() {
  const [players, setPlayers] = useState<Row[]>([])
  const [latest, setLatest] = useState<Latest>(null)
  const [recent, setRecent] = useState<Recent[]>([])
  // Once the big day starts, the TV and every phone open on the wedding board.
  const [board, setBoard] = useState<Board>(() =>
    weddingDayStarted() ? 'wedding' : 'practice',
  )

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const res = await fetch(`/api/leaderboard?board=${board}`)
        if (res.ok && active) {
          const data = await res.json()
          setPlayers(data.players ?? [])
          setLatest(data.latest ?? null)
          setRecent(data.recent ?? [])
        }
      } catch {
        // keep the last good board on screen
      }
    }
    load()
    const interval = setInterval(load, 4000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [board])

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center gap-8 px-5 py-8 pb-28 sm:gap-10 sm:px-10 sm:py-12 sm:pb-28">
      <header className="flex flex-col items-center gap-1 text-center">
        <p className="hello">
          sláinte<span className="dot">•</span>skål
        </p>
        <h1 className="names mt-1 text-6xl sm:text-8xl">
          Split the <span className="split-g">G</span>
        </h1>
        <p className="flabel mt-2">the wedding championship</p>
        <p className="text-sm text-ink-mid">Serine &amp; Eóin &middot; 24 July 2026</p>
        <div className="rule mt-3 w-80" />
        <div className="mt-5 flex items-center gap-2 rounded-full border-[1.5px] border-ink-faint bg-white/45 p-1">
          {(
            [
              {key: 'wedding', label: 'the big day'},
              {key: 'practice', label: 'practice'},
            ] as {key: Board; label: string}[]
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.key === board) return
                setPlayers([])
                setLatest(null)
                setRecent([])
                setBoard(tab.key)
              }}
              className={`flabel rounded-full px-5 py-2 transition ${
                board === tab.key ? 'bg-ink text-paper' : 'text-ink-mid'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm italic text-ink-mid">
          {board === 'wedding'
            ? 'only pints poured on 24 July count here'
            : 'every warm-up pint before (and after) the big day'}
        </p>
      </header>

      {latest?.splitVerdict?.banter && (
        <blockquote className="max-w-3xl text-center text-xl italic leading-relaxed text-coral sm:text-3xl">
          &ldquo;{latest.splitVerdict.banter}&rdquo;
          <footer className="flabel mt-3 not-italic">
            — the judge, on {latest.playerName}
            {latest.mode === 'dropHarp' ? "'s harp drop" : "'s G split"}
          </footer>
        </blockquote>
      )}

      <table className="w-full max-w-4xl border-separate border-spacing-y-1 text-lg sm:text-2xl">
        <thead>
          <tr className="flabel text-left">
            <th className="px-4 pb-3 font-bold">#</th>
            <th className="pb-3 font-bold">Name</th>
            <th className="hidden pb-3 text-right font-bold sm:table-cell">Gs</th>
            <th className="hidden pb-3 text-right font-bold sm:table-cell">Harps</th>
            <th className="pb-3 text-right font-bold">Points</th>
            <th className="hidden pb-3 text-right font-bold sm:table-cell">Attempts</th>
            <th className="px-4 pb-3 text-right font-bold">Best</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => (
            <tr
              key={p._id}
              className={i === 0 ? 'bg-wash text-ink' : 'text-ink-deep'}
            >
              <td className="rounded-l-xl px-4 py-3 tabular-nums">
                {i === 0 ? '🏆' : i + 1}
              </td>
              <td className="py-3 font-bold">{p.name}</td>
              <td className="hidden py-3 text-right tabular-nums sm:table-cell">{p.gs}</td>
              <td className="hidden py-3 text-right tabular-nums sm:table-cell">{p.harps}</td>
              <td className="py-3 text-right text-2xl font-bold tabular-nums sm:text-3xl">{p.points}</td>
              <td className="hidden py-3 text-right tabular-nums text-ink-soft sm:table-cell">{p.attempts}</td>
              <td className="rounded-r-xl px-4 py-3 text-right tabular-nums">
                {p.best != null ? p.best.toFixed(2) : '—'}
              </td>
            </tr>
          ))}
          {players.length === 0 && (
            <tr>
              <td colSpan={7} className="py-16 text-center text-2xl italic text-ink-soft">
                {board === 'wedding'
                  ? 'The big-day board is bare — first pint of the wedding takes the early lead.'
                  : 'No pints judged yet. Get pouring.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {recent.length > 0 && (
        <section className="flex w-full flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <h2 className="names text-4xl text-ink-mid">The wall of pints</h2>
            <div className="rule w-40" />
          </div>
          <div className="w-full columns-1 gap-3 min-[430px]:columns-2 sm:columns-3 lg:columns-4 xl:columns-5">
            {recent.map((a) => (
              <PintCard key={a._id} a={a} />
            ))}
          </div>
        </section>
      )}

      <footer className="mt-auto flex flex-col items-center gap-4 pt-6">
        <Link href="/" className="flabel underline decoration-ink-faint underline-offset-8">
          back to the feed
        </Link>
        <PintsSign />
      </footer>
      <BottomNav />
    </main>
  )
}
