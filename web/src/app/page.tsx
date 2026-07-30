import Link from 'next/link'
import {PintsSign} from '@/components/Brand'
import {WEDDING_EVENT} from '@/lib/event'

const STEPS: {title: string; body: string}[] = [
  {
    title: 'Name your event',
    body: 'A wedding, a stag do, an office night out — give it a name, pick a colour, and you get a shareable link and a QR code for the table.',
  },
  {
    title: 'Guests scan and play',
    body: 'They pick their name, take one honest sip, and hold the glass up. The camera finds the G, snaps it itself, and Claude judges where the line landed.',
  },
  {
    title: 'A live feed and a leaderboard',
    body: 'Every pint lands on a shared feed guests can like, with a live championship board. Best splits by the end of the night win.',
  },
]

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center gap-10 px-5 py-12 text-center">
      <header className="flex flex-col items-center gap-2">
        <p className="hello">
          sláinte<span className="dot">•</span>skål
        </p>
        <h1 className="names text-6xl leading-none sm:text-8xl">
          Split the <span className="split-g">G</span>
        </h1>
        <p className="mt-2 max-w-md text-lg leading-relaxed text-ink-deep">
          The pint game for your event — one glass, one brave sip, and an incorruptible judge.
        </p>
      </header>

      <div className="flex flex-col items-center gap-4">
        <Link href="/new" className="fbtn text-xl">
          create your event
        </Link>
        <Link
          href={`/e/${WEDDING_EVENT.slug}`}
          className="flabel underline decoration-ink-faint underline-offset-8"
        >
          see it in action — a real wedding
        </Link>
      </div>

      <section className="flex w-full max-w-xl flex-col gap-3 text-left">
        {STEPS.map((step, i) => (
          <div key={step.title} className="card flex items-start gap-4">
            <span className="names shrink-0 text-3xl text-coral">{i + 1}</span>
            <div>
              <p className="flabel">{step.title}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-deep">{step.body}</p>
            </div>
          </div>
        ))}
      </section>

      <Link href="/new" className="fbtn fbtn-outline">
        start your championship
      </Link>

      <footer className="mt-auto pt-6">
        <PintsSign signoff="le grá • med kjærlighet" />
      </footer>
    </main>
  )
}
