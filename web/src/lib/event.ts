import {WEDDING_DAY_FROM, WEDDING_DAY_TO} from './wedding'

// Base URL for QR codes and share links. Overridable per deployment; the
// product lives on split.eoin.no, the wedding shrine on its own domain.
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://split.eoin.no'

export type Theme = {ink: string; coral: string}

// A theme is just two colours; the rest of the ink ramp is derived (themeVars).
export const THEME_PRESETS: Record<string, {label: string} & Theme> = {
  classic: {label: 'Ballpoint blue', ink: '#414198', coral: '#e06a45'},
  stout: {label: 'Stout & gold', ink: '#211f1d', coral: '#c1922f'},
  forest: {label: 'Forest & amber', ink: '#2f5d50', coral: '#e07a3f'},
  wine: {label: 'Wine & rose', ink: '#6d2440', coral: '#d98f5b'},
  midnight: {label: 'Midnight & coral', ink: '#26315c', coral: '#e0654f'},
}

export type EventConfig = {
  id: string | null // Sanity event _id; null = legacy wedding-shrine data
  slug: string
  name: string // who it's for — "Serine & Eóin", "Dave's Stag"
  kicker: string // "the wedding championship"
  hello: string // greeting — "sláinte • skål"
  signoff: string // "le grá • med kjærlighet"
  dateLabel: string // "24 July 2026"
  startsAt: string
  endsAt: string
  championshipLabel: string // in-window board — "the big day"
  practiceLabel: string // out-of-window board — "practice"
  theme: Theme
}

// The wedding, preserved as the built-in first event. id:null means its pints
// are the legacy documents with no event reference, so the product reads the
// same data the shrine does without any migration.
export const WEDDING_EVENT: EventConfig = {
  id: null,
  slug: 'serine-eoin',
  name: 'Serine & Eóin',
  kicker: 'the wedding championship',
  hello: 'sláinte • skål',
  signoff: 'le grá • med kjærlighet',
  dateLabel: '24 July 2026',
  startsAt: WEDDING_DAY_FROM,
  endsAt: WEDDING_DAY_TO,
  championshipLabel: 'the big day',
  practiceLabel: 'practice',
  theme: THEME_PRESETS.classic,
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'event'
  )
}

// Build an EventConfig from a Sanity event document.
export function eventFromDoc(doc: Record<string, unknown>): EventConfig {
  const s = (k: string, fallback = '') => (typeof doc[k] === 'string' ? (doc[k] as string) : fallback)
  return {
    id: doc._id as string,
    slug: s('slug'),
    name: s('name'),
    kicker: s('kicker', 'the championship'),
    hello: s('hello', 'sláinte'),
    signoff: s('signoff'),
    dateLabel: s('dateLabel'),
    startsAt: s('startsAt'),
    endsAt: s('endsAt'),
    championshipLabel: s('championshipLabel', 'the main event'),
    practiceLabel: s('practiceLabel', 'warm-up'),
    theme: {
      ink: s('themeInk', THEME_PRESETS.classic.ink),
      coral: s('themeCoral', THEME_PRESETS.classic.coral),
    },
  }
}

// GROQ scope for an event: the wedding is the legacy documents (no event ref);
// every other event scopes by reference. Pair with {eventId} in params.
export function eventFilter(id: string | null): string {
  return id ? 'event._ref == $eventId' : '!defined(event._ref)'
}

// Derive the full ink ramp + coral pair from a theme's two colours, as CSS
// custom properties for a wrapper element. Tailwind utilities read these vars,
// so overriding them on a container re-themes everything inside it.
export function themeVars(theme: Theme, paper = '#f6f0e1'): Record<string, string> {
  const mix = (c: string, pct: number, other: string) =>
    `color-mix(in srgb, ${c} ${pct}%, ${other})`
  return {
    '--color-ink': theme.ink,
    '--color-ink-deep': mix(theme.ink, 82, 'black'),
    '--color-ink-mid': mix(theme.ink, 70, paper),
    '--color-ink-soft': mix(theme.ink, 45, paper),
    '--color-ink-faint': mix(theme.ink, 22, paper),
    '--color-wash': mix(theme.ink, 12, paper),
    '--color-coral': theme.coral,
    '--color-coral-soft': mix(theme.coral, 60, paper),
  }
}

export const eventUrl = (slug: string) => `${APP_URL}/e/${slug}`
