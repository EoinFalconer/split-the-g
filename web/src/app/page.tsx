'use client'

import {useCallback, useEffect, useRef, useState} from 'react'
import Link from 'next/link'
import {PourLoader, PintsSign} from '@/components/Brand'
import {BottomNav} from '@/components/Nav'

type Geometry = {
  boxX?: number
  boxY?: number
  boxW?: number
  boxH?: number
  lineYNorm?: number
}

type Post = {
  _id: string
  playerName: string
  mode: string
  img: string
  imgW: number | null
  imgH: number | null
  split: boolean
  score: number | null
  banter: string | null
  caption: string | null
  venue: string | null
  createdAt: string
  localGeometry: Geometry | null
  likes: number
  liked: boolean
  likedNames: string[]
}

const DEVICE_KEY = 'stg-device'
const PLAYER_KEY = 'stg-player'
const POLL_MS = 8000

// Anonymous, drunk-proof like identity: one id per browser, minted on first
// visit. No login at a wedding bar.
function getDeviceId(): string {
  let id = window.localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `dev-${Math.random().toString(36).slice(2)}-${Date.now()}`
    window.localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

function getPlayerName(): string {
  try {
    const saved = window.localStorage.getItem(PLAYER_KEY)
    if (saved) return JSON.parse(saved).name ?? ''
  } catch {
    // corrupt value — like anonymously
  }
  return ''
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? 'yesterday' : `${d}d ago`
}

const pct = (n: number) => `${(n * 100).toFixed(2)}%`

function Heart({filled}: {filled: boolean}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  )
}

function slainteLine(p: Post): string | null {
  if (p.likes === 0) return null
  const names = p.likedNames.filter(Boolean)
  if (names.length === 0) return `sláinte × ${p.likes}`
  const rest = p.likes - names.length
  return `sláinte from ${names.join(', ')}${rest > 0 ? ` and ${rest} more` : ''}`
}

function PostCard({post, onLike}: {post: Post; onLike: (post: Post) => void}) {
  const g = post.localGeometry
  const hasBox =
    g != null && g.boxX != null && g.boxY != null && g.boxW != null && g.boxH != null
  const aspect =
    post.imgW && post.imgH ? `${post.imgW} / ${post.imgH}` : '3 / 4'
  const slainte = slainteLine(post)
  return (
    <article className="overflow-hidden rounded-2xl border-[1.5px] border-ink-faint bg-white/45">
      <header className="flex items-center gap-3 px-4 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink-faint bg-wash">
          <span className="names text-2xl leading-none text-ink">
            {(post.playerName || '?').charAt(0).toUpperCase()}
          </span>
        </span>
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate font-bold leading-tight text-ink-deep">{post.playerName}</p>
          <p className="truncate text-xs text-ink-soft">
            {post.venue && <>📍 {post.venue}{' · '}</>}
            {timeAgo(post.createdAt)}
            {' · '}
            {post.mode === 'dropHarp' ? 'drop the harp' : 'split the G'}
          </p>
        </div>
        <span
          className={`flabel shrink-0 ${post.split ? 'text-coral' : 'text-ink-soft'}`}
        >
          {post.split ? (post.mode === 'dropHarp' ? 'harp dropped' : 'G split!') : 'miss'}
        </span>
      </header>

      <div className="relative" style={{aspectRatio: aspect}}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${post.img}?w=900&auto=format`}
          alt={`${post.playerName}'s pint`}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {hasBox && (
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute rounded-sm border-2 border-ink-soft"
              style={{
                left: pct(g!.boxX!),
                top: pct(g!.boxY!),
                width: pct(g!.boxW!),
                height: pct(g!.boxH!),
              }}
            />
            {g!.lineYNorm != null && (
              <div
                className={`absolute left-0 right-0 ${post.split ? 'bg-coral' : 'bg-paper'}`}
                style={{top: pct(g!.lineYNorm), height: '2px'}}
              />
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-4 pt-3">
        <button
          onClick={() => onLike(post)}
          aria-label={post.liked ? 'Unlike this pint' : 'Like this pint'}
          className={`flex items-center gap-2 transition active:scale-90 ${
            post.liked ? 'text-coral' : 'text-ink-mid'
          }`}
        >
          <Heart filled={post.liked} />
          <span className="text-lg font-bold tabular-nums">{post.likes > 0 ? post.likes : ''}</span>
        </button>
        <span className="ml-auto text-lg font-bold tabular-nums text-ink">
          {post.score != null && (
            <>
              {post.score.toFixed(2)}
              <span className="font-normal text-ink-soft"> / 5</span>
            </>
          )}
        </span>
      </div>

      {slainte && <p className="px-4 pt-1 text-sm text-ink-soft">{slainte}</p>}

      {post.caption && (
        <p className="px-4 pt-2 text-[15px] leading-relaxed text-ink-deep">
          <span className="font-bold">{post.playerName}</span> {post.caption}
        </p>
      )}

      {post.banter && (
        <p className="px-4 pb-4 pt-2 text-[15px] italic leading-relaxed text-coral">
          &ldquo;{post.banter}&rdquo;{' '}
          <span className="not-italic text-xs text-ink-soft">— the judge</span>
        </p>
      )}
      {!post.banter && <div className="pb-4" />}
    </article>
  )
}

export default function Feed() {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const deviceRef = useRef('')
  const loadingMoreRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const postsRef = useRef<Post[] | null>(null)
  postsRef.current = posts

  // Fetch the newest page and fold it in: fresh versions win (like counts
  // move), unseen posts go on top, older pages stay below.
  const refresh = useCallback(async () => {
    const res = await fetch(`/api/feed?device=${deviceRef.current}`)
    if (!res.ok) return
    const {items, hasMore: more} = await res.json()
    setPosts((prev) => {
      if (!prev) {
        setHasMore(more)
        return items
      }
      const freshIds = new Set(items.map((i: Post) => i._id))
      return [...items, ...prev.filter((p) => !freshIds.has(p._id))]
    })
  }, [])

  useEffect(() => {
    deviceRef.current = getDeviceId()
    refresh()
    const interval = setInterval(() => {
      refresh().catch(() => {
        // network blip at the bar — the next poll will catch up
      })
    }, POLL_MS)
    return () => clearInterval(interval)
  }, [refresh])

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return
    loadingMoreRef.current = true
    try {
      const current = postsRef.current
      const last = current && current.length > 0 ? current[current.length - 1] : null
      if (!last) return
      const res = await fetch(
        `/api/feed?device=${deviceRef.current}&before=${encodeURIComponent(last.createdAt)}`,
      )
      if (!res.ok) return
      const {items, hasMore: more} = await res.json()
      setPosts((prev) => {
        if (!prev) return items
        const known = new Set(prev.map((p) => p._id))
        return [...prev, ...items.filter((i: Post) => !known.has(i._id))]
      })
      setHasMore(more)
    } finally {
      loadingMoreRef.current = false
    }
  }, [])

  // Infinite scroll: pull the next page in as the sentinel nears the viewport.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore()
      },
      {rootMargin: '600px'},
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  const toggleLike = useCallback(async (post: Post) => {
    const flip = (p: Post, liked: boolean, likes: number) =>
      p._id === post._id ? {...p, liked, likes} : p
    // Optimistic — the bar has patchy wifi and the heart should feel instant.
    setPosts((prev) =>
      prev?.map((p) => flip(p, !post.liked, post.likes + (post.liked ? -1 : 1))) ?? prev,
    )
    try {
      const res = await fetch(`/api/attempts/${post._id}/like`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({deviceId: deviceRef.current, name: getPlayerName()}),
      })
      if (!res.ok) throw new Error(`like failed: ${res.status}`)
      const {liked, likes} = await res.json()
      setPosts((prev) => prev?.map((p) => flip(p, liked, likes)) ?? prev)
    } catch {
      setPosts((prev) => prev?.map((p) => flip(p, post.liked, post.likes)) ?? prev)
    }
  }, [])

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col pb-28">
      <header className="sticky top-0 z-10 border-b border-ink-faint/50 bg-paper/85 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-2.5">
          <h1 className="names text-3xl leading-none">
            Split the <span className="split-g">G</span>
          </h1>
          <Link href="/play" className="fbtn fbtn-sm">
            pour one
          </Link>
        </div>
      </header>

      <div className="flex flex-col items-center gap-1 px-4 pb-2 pt-5 text-center">
        <p className="hello">
          sláinte<span className="dot">•</span>skål
        </p>
        <p className="flabel">the wedding championship &middot; 24 july 2026</p>
        <div className="rule mt-2 w-56" />
      </div>

      {posts === null && <PourLoader message="Pouring the feed…" />}

      {posts !== null && posts.length === 0 && (
        <section className="flex flex-col items-center gap-6 px-5 py-16 text-center">
          <p className="text-2xl italic text-ink-mid">
            Not a single pint on the wall yet.
          </p>
          <Link href="/play" className="fbtn">
            pour the first one
          </Link>
        </section>
      )}

      {posts !== null && posts.length > 0 && (
        <section className="flex flex-col gap-5 px-3 pt-3">
          {posts.map((post) => (
            <PostCard key={post._id} post={post} onLike={toggleLike} />
          ))}
        </section>
      )}

      <div ref={sentinelRef} />
      {hasMore && (
        <button
          onClick={loadMore}
          className="flabel mx-auto mt-6 underline decoration-ink-faint underline-offset-8"
        >
          pour in more
        </button>
      )}

      <footer className="mt-auto flex justify-center pt-10">
        <PintsSign />
      </footer>
      <BottomNav />
    </main>
  )
}
