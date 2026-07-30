/* eslint-disable @next/next/no-img-element */

import type {EventConfig} from '@/lib/event'

// Split the wordmark into wiggling letters, like the invitation's SplitText
function WiggleText({text}: {text: string}) {
  return (
    <span>
      {text.split('').map((char, i) =>
        char === ' ' ? (
          <span key={i} className="inline-block" style={{width: '0.35em'}}>
            &nbsp;
          </span>
        ) : (
          <span key={i} className="letter">
            {char}
          </span>
        ),
      )}
    </span>
  )
}

export function Brand({event, compact = false}: {event: EventConfig; compact?: boolean}) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      {!compact && event.hello && (
        <p className="hello">{withDot(event.hello)}</p>
      )}
      <h1 className={`names ${compact ? 'text-5xl' : 'text-6xl sm:text-7xl'} mt-1`}>
        <WiggleText text="Split the " />
        <span className="split-g">G</span>
      </h1>
      <p className="flabel mt-2">{event.kicker}</p>
      <p className="text-sm text-ink-mid">
        {event.name}
        {event.dateLabel ? ` · ${event.dateLabel}` : ''}
      </p>
      <div className="rule mt-3 w-56" />
    </div>
  )
}

export function PourLoader({message}: {message: string}) {
  return (
    <section className="flex flex-col items-center gap-8 py-6">
      <div className="pint" />
      <p className="max-w-md text-center text-2xl italic text-ink-mid sm:text-3xl">{message}</p>
    </section>
  )
}

// Render a "sláinte • skål"-style greeting with the middle bullet styled.
export function withDot(text: string) {
  const parts = text.split('•')
  if (parts.length < 2) return text
  return (
    <>
      {parts[0].trim()}
      <span className="dot">•</span>
      {parts.slice(1).join('•').trim()}
    </>
  )
}

export function PintsSign({signoff = '', className = ''}: {signoff?: string; className?: string}) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <img src="/pints-blue.svg" alt="" className="h-9 w-auto" />
      {signoff && (
        <p className="hello" style={{fontSize: 17}}>
          {withDot(signoff)}
        </p>
      )}
    </div>
  )
}
