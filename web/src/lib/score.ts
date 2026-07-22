// Scores are stored 0–5 (5 = the line dead centre of the target) but spoken
// everywhere as a percentage of perfect — guests get "96%", not "4.80/5".
export const scorePct = (score: number) => Math.round(score * 20)

export const perfectLabel = (mode: string) =>
  mode === 'dropHarp' ? 'of a perfect drop' : 'of a perfect split'

// Board currency. Split the G: middle of the G = 1, elsewhere on the G = ½,
// off the G = 0. Drop the Harp: the gap = 1, all or nothing.
export const fmtPoints = (p: number) => {
  const whole = Math.floor(p)
  if (p - whole >= 0.5) return whole === 0 ? '½' : `${whole}½`
  return `${whole}`
}
