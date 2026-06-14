// Parse and sanitise the client-sent capture geometry. It's untrusted input
// (a party game on a public URL), so clamp everything to sane ranges before it
// ever reaches the verdict.
export type StoredGeometry = {
  split: boolean
  score: number
  lineInG: number
  conf: number
  boxX?: number
  boxY?: number
  boxW?: number
  boxH?: number
  lineYNorm?: number
}

// Normalised image coords; allow slight overflow but reject nonsense.
function coord(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v)
    ? Math.max(-1, Math.min(2, v))
    : undefined
}

export function parseGeometry(raw: FormDataEntryValue | null): StoredGeometry | null {
  if (typeof raw !== 'string') return null
  try {
    const g = JSON.parse(raw)
    if (typeof g.score !== 'number' || typeof g.lineInG !== 'number') return null
    const stored: StoredGeometry = {
      split: Boolean(g.split),
      score: Math.max(0, Math.min(5, g.score)),
      lineInG: Math.max(-5, Math.min(5, g.lineInG)),
      conf: Math.max(0, Math.min(1, Number(g.conf) || 0)),
    }
    const boxX = coord(g.boxX)
    const boxY = coord(g.boxY)
    const boxW = coord(g.boxW)
    const boxH = coord(g.boxH)
    const lineYNorm = coord(g.lineYNorm)
    if (boxX !== undefined && boxY !== undefined && boxW !== undefined && boxH !== undefined) {
      Object.assign(stored, {boxX, boxY, boxW, boxH, lineYNorm})
    }
    return stored
  } catch {
    return null
  }
}
