// The big day: 24 July 2026 in Europe/Oslo (UTC+2 in July). Everything inside
// this window scores on the wedding-day board; everything outside is practice.
export const WEDDING_DAY_FROM = '2026-07-23T22:00:00Z'
export const WEDDING_DAY_TO = '2026-07-24T22:00:00Z'

export type Board = 'wedding' | 'practice'

export function weddingDayStarted(now = new Date()): boolean {
  return now.toISOString() >= WEDDING_DAY_FROM
}
