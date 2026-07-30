'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'

// Floating bottom navigation, Instagram-style but in stationery: the feed, the
// big pour button, the board — all scoped to one event. Pages using it need
// bottom padding (pb-28) so the last card scrolls clear of it.
export function BottomNav({slug}: {slug: string}) {
  const pathname = usePathname()
  const base = `/e/${slug}`
  const item = (active: boolean) => `flabel transition ${active ? 'text-ink' : 'text-ink-soft'}`
  return (
    <nav className="fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
      <div className="flex items-center gap-8 rounded-full border-[1.5px] border-ink-faint bg-paper/90 px-8 py-2 shadow-[0_8px_30px_rgba(65,65,152,0.18)] backdrop-blur">
        <Link href={base} className={item(pathname === base)}>
          feed
        </Link>
        <Link
          href={`${base}/play`}
          aria-label="Pour one — play Split the G"
          className="flex h-14 w-14 -my-2 items-center justify-center rounded-full border-[3px] border-paper bg-ink shadow-[0_6px_20px_rgba(65,65,152,0.35)] transition active:scale-90"
        >
          {/* .names hard-codes ink; inline paper wins over both class colors */}
          <span className="names split-g text-3xl leading-none" style={{color: 'var(--color-paper)'}}>
            G
          </span>
        </Link>
        <Link href={`${base}/leaderboard`} className={item(pathname === `${base}/leaderboard`)}>
          board
        </Link>
      </div>
    </nav>
  )
}
