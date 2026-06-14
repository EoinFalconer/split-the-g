// Parse and sanitise the client-sent capture geometry. It's untrusted input
// (a party game on a public URL), so clamp everything to sane ranges before it
// ever reaches the verdict.
export type StoredGeometry = {
  split: boolean
  score: number
  lineInG: number
  conf: number
}

export function parseGeometry(raw: FormDataEntryValue | null): StoredGeometry | null {
  if (typeof raw !== 'string') return null
  try {
    const g = JSON.parse(raw)
    if (typeof g.score !== 'number' || typeof g.lineInG !== 'number') return null
    return {
      split: Boolean(g.split),
      score: Math.max(0, Math.min(5, g.score)),
      lineInG: Math.max(-5, Math.min(5, g.lineInG)),
      conf: Math.max(0, Math.min(1, Number(g.conf) || 0)),
    }
  } catch {
    return null
  }
}
