export function Brand({compact = false}: {compact?: boolean}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <p className="text-xs uppercase tracking-[0.45em] text-cream-dim sm:text-sm">
        Serine &amp; Eóin &middot; 24 July 2026
      </p>
      <h1
        className={`font-bold tracking-tight text-cream ${
          compact ? 'text-5xl' : 'text-6xl sm:text-7xl'
        }`}
      >
        Split the <span className="split-g italic text-gold-bright">G</span>
      </h1>
      <p className="text-base italic tracking-wide text-cream-dim sm:text-lg">
        the wedding championship
      </p>
      <div className="rule mt-2 w-56" />
    </div>
  )
}

export function PourLoader({message}: {message: string}) {
  return (
    <section className="flex flex-col items-center gap-8 py-6">
      <div className="pint" />
      <p className="max-w-md text-center text-2xl italic text-cream-dim sm:text-3xl">
        {message}
      </p>
    </section>
  )
}
