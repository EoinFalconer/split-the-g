/* eslint-disable @next/next/no-img-element */

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

export function Brand({compact = false}: {compact?: boolean}) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      {!compact && (
        <p className="hello">
          sláinte<span className="dot">•</span>skål
        </p>
      )}
      <h1 className={`names ${compact ? 'text-5xl' : 'text-6xl sm:text-7xl'} mt-1`}>
        <WiggleText text="Split the " />
        <span className="split-g">G</span>
      </h1>
      <p className="flabel mt-2">
        the wedding championship
      </p>
      <p className="text-sm text-ink-mid">Serine &amp; Eóin &middot; 24 July 2026</p>
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

export function PintsSign({className = ''}: {className?: string}) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <img src="/pints-blue.svg" alt="" className="h-9 w-auto" />
      <p className="hello" style={{fontSize: 17}}>
        le grá<span className="dot">•</span>med kjærlighet
      </p>
    </div>
  )
}
