'use client'

import {useEffect, useState} from 'react'
import Link from 'next/link'

type Row = {
  _id: string
  name: string
  splits: number
  attempts: number
  best: number | null
}

type Latest = {
  playerName: string
  splitVerdict: {split: boolean; score: number; banter?: string}
} | null

export default function Leaderboard() {
  const [players, setPlayers] = useState<Row[]>([])
  const [latest, setLatest] = useState<Latest>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const res = await fetch('/api/leaderboard')
        if (res.ok && active) {
          const data = await res.json()
          setPlayers(data.players ?? [])
          setLatest(data.latest ?? null)
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
  }, [])

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center gap-10 px-10 py-12">
      <header className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm uppercase tracking-[0.5em] text-cream-dim">
          Serine &amp; Eóin &middot; 24 July 2026
        </p>
        <h1 className="text-7xl font-bold tracking-tight text-cream sm:text-8xl">
          Split the <span className="split-g italic text-gold-bright">G</span>
        </h1>
        <p className="text-xl italic tracking-wide text-cream-dim">the wedding championship</p>
        <div className="rule mt-3 w-80" />
      </header>

      {latest?.splitVerdict?.banter && (
        <blockquote className="max-w-3xl text-center text-2xl italic leading-relaxed text-gold-bright sm:text-3xl">
          &ldquo;{latest.splitVerdict.banter}&rdquo;
          <footer className="mt-2 text-lg not-italic tracking-[0.3em] text-cream-dim">
            — the judge, on {latest.playerName}
          </footer>
        </blockquote>
      )}

      <table className="w-full max-w-4xl border-separate border-spacing-y-1 text-3xl">
        <thead>
          <tr className="text-left text-base uppercase tracking-[0.35em] text-cream-dim">
            <th className="px-4 pb-3 font-normal">#</th>
            <th className="pb-3 font-normal">Name</th>
            <th className="pb-3 text-right font-normal">Gs split</th>
            <th className="pb-3 text-right font-normal">Attempts</th>
            <th className="px-4 pb-3 text-right font-normal">Best</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => (
            <tr
              key={p._id}
              className={
                i === 0
                  ? 'bg-gradient-to-r from-gold/15 via-gold/5 to-transparent text-gold-bright'
                  : 'text-cream'
              }
            >
              <td className="rounded-l-xl px-4 py-4 tabular-nums">
                {i === 0 ? '🏆' : i + 1}
              </td>
              <td className="py-4 font-bold">{p.name}</td>
              <td className="py-4 text-right text-4xl font-bold tabular-nums">{p.splits}</td>
              <td className="py-4 text-right tabular-nums text-cream-dim">{p.attempts}</td>
              <td className="rounded-r-xl px-4 py-4 text-right tabular-nums">
                {p.best != null ? p.best.toFixed(2) : '—'}
              </td>
            </tr>
          ))}
          {players.length === 0 && (
            <tr>
              <td colSpan={5} className="py-16 text-center text-2xl italic text-cream/40">
                No pints judged yet. Get pouring.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <footer className="mt-auto flex flex-col items-center gap-3 pt-6">
        <div className="rule w-56" />
        <Link
          href="/"
          className="text-sm uppercase tracking-[0.4em] text-cream/40 underline-offset-8 hover:underline"
        >
          back to the bar
        </Link>
      </footer>
    </main>
  )
}
