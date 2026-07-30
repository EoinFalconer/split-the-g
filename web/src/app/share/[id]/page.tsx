import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {sanity} from '@/lib/sanity'
import {ShareActions} from './ShareActions'

export const dynamic = 'force-dynamic'

type Params = {params: Promise<{id: string}>}

async function getAttempt(id: string) {
  return sanity.fetch(
    `*[_type == "attempt" && _id == $id && status == "scored"][0]{
      "playerName": player->name,
      "mode": coalesce(mode, "splitG"),
      "split": splitVerdict.split,
      "score": splitVerdict.score
    }`,
    {id},
  )
}

export async function generateMetadata({params}: Params): Promise<Metadata> {
  const {id} = await params
  const a = await getAttempt(id)
  const name = a?.playerName ?? 'A pint'
  const title = `${name} · Split the G`
  const description = a
    ? `${name} scored ${Math.round((a.score ?? 0) * 20)}% on the Split the G championship.`
    : 'Split the G — the wedding championship.'
  return {
    metadataBase: new URL('https://split-the-g.eoin.no'),
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{url: `/api/share/${id}`, width: 1080, height: 1920}],
    },
    twitter: {card: 'summary_large_image', title, description, images: [`/api/share/${id}`]},
  }
}

export default async function SharePage({params}: Params) {
  const {id} = await params
  const a = await getAttempt(id)
  if (!a) notFound()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center gap-7 px-5 py-10 text-center">
      <div className="flex flex-col items-center gap-1">
        <h1 className="names text-4xl">
          {a.playerName}&apos;s <span className="split-g">G</span>
        </h1>
        <p className="flabel">your pint, ready to share</p>
      </div>

      <div className="w-full max-w-xs overflow-hidden rounded-2xl border-[1.5px] border-ink-faint shadow-[0_8px_30px_rgba(65,65,152,0.18)]">
        {/* The generated story card. eslint-disable-next-line @next/next/no-img-element */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/share/${id}`} alt={`${a.playerName}'s Split the G card`} className="block h-auto w-full" />
      </div>

      <ShareActions id={id} playerName={a.playerName} />
    </main>
  )
}
