import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { GuestWishCard } from '../../../components/guest/GuestWishCard'
import { ButtonLink } from '../../../components/ui/Button'
import { currentUserId } from '../../../lib/auth/session'
import { formatWishCount } from '../../../lib/domain'
import { loadGuestList } from '../../../lib/share/guestList'

/**
 * Guest view — docs/stage-2.md §5.3.
 *
 * Entirely server-rendered, and deliberately free of Client Components: it has
 * to work with JavaScript disabled, which is an explicit acceptance item. This
 * is the one screen where server rendering earns its keep — it opens fast, it
 * survives a hostile network, and it produces real OG tags for messengers.
 *
 * There is no "view as guest" gate. The list renders immediately; the CTA at
 * the bottom does the job a gate would have done, pointing the other way —
 * not "let me in" but "make your own".
 */

interface PageProps {
  params: Promise<{ token: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { token } = await params
  const list = await loadGuestList(token)
  if (!list) return { title: 'Такого списку не існує' }

  const title = `Список бажань ${list.name}`
  const description = formatWishCount(list.wishes.length)
  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
  }
}

export default async function GuestListPage({ params }: PageProps) {
  const { token } = await params
  const list = await loadGuestList(token)

  // A token nobody owns is a missing page, not a server error — `notFound()`
  // renders the not-found route with a real 404 rather than a 500.
  if (!list) notFound()

  const viewerId = await currentUserId()
  const isOwner = viewerId === list.ownerId
  const isEmpty = list.wishes.length === 0

  return (
    <main className="mx-auto max-w-page px-6 py-10">
      {/* Confetti Amber lives here and on the owner's Share banner, nowhere
          else (docs/spec.md §8) — the cards and the CTA below stay neutral so
          the accent doesn't spread. */}
      <div className="rounded-card bg-confetti-amber p-6 text-ink sm:p-8">
        <h1 className="text-heading-lg font-semibold sm:text-display">
          Список бажань {list.name}
        </h1>
        <p className="mt-2 text-body-lg font-medium">
          {formatWishCount(list.wishes.length)}
        </p>
      </div>

      {isOwner ? (
        <p className="mt-4 text-body text-mid-gray">
          Так твій список бачать друзі
        </p>
      ) : null}

      {isEmpty ? (
        <p className="mt-8 text-center text-subheading text-mid-gray">
          Тут поки порожньо
        </p>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.wishes.map((wish) => (
            <GuestWishCard key={wish.id} wish={wish} />
          ))}
        </div>
      )}

      {/* Neutral Card, not Amber, and no modal or timer — the CTA is meant to
          be noticeable, not insistent (stage-2.md §5.3).
          `ButtonLink` is a Client Component, but it renders as a plain <a> in
          the server HTML, so it still works with scripting off; reusing it
          keeps the button styling single-sourced. */}
      <div className="mt-10 rounded-card border border-hairline bg-paper p-6 shadow-subtle">
        {viewerId ? (
          <ButtonLink href="/">Мій список</ButtonLink>
        ) : (
          <ButtonLink href="/register">Створити свій список бажань</ButtonLink>
        )}
      </div>
    </main>
  )
}
