import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { GuestGrid } from '../../../components/guest/GuestGrid'
import { GuestWishCard } from '../../../components/guest/GuestWishCard'
import { ButtonLink } from '../../../components/ui/Button'
import { currentUserId } from '../../../lib/auth/session'
import { formatWishCount } from '../../../lib/domain'
import { readGuestId } from '../../../lib/guests/guestId'
import { loadGuestList } from '../../../lib/share/guestList'
import { loadReservationView } from '../../../lib/share/guestReservations'

/**
 * Guest view — docs/stage-2.md §5.3.
 *
 * Server-rendered end to end: the list, the banner, the 404 and the OG tags for
 * messengers all resolve before anything reaches the browser. This is the one
 * screen where that really earns its keep — it opens fast and it survives a
 * hostile network.
 *
 * Reservation (§5.4) added the screen's first interactive element, so the grid
 * a *guest* sees is now a Client Component. Everything on this page still
 * renders without JavaScript, including the «Заброньовано: …» badges; what
 * stops working with scripting off is reserving and cancelling. `GuestGrid`'s
 * own comment explains why that was the better trade. The owner's branch is
 * untouched and has no client code at all.
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

  /**
   * The owner/guest split (docs/prompter-task-reservations.md §5).
   *
   * The branch is here, above the render, and it decides whether the
   * `reservations` collection is queried *at all* — not whether a badge is
   * displayed. On the owner's branch `reservationView` is never computed, so
   * `loadReservationView` never runs, no reservation field exists on anything
   * this component holds, and there is nothing for the RSC payload to carry.
   * Their `/w/{token}` is the plain `wishRepository.list(ownerId)` the hub
   * itself uses, rendered through the same `GuestWishCard` as before.
   *
   * Deliberately *not* one loader that takes an `isOwner` flag: that shape puts
   * the owner's privacy one forgotten argument away from failing, and it is the
   * shape §5 names as the thing not to build.
   */
  const reservationView = isOwner
    ? null
    : await loadReservationView(list.ownerId, await readGuestId())

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
      ) : reservationView ? (
        <GuestGrid
          shareToken={token}
          wishes={list.wishes}
          initialView={reservationView}
        />
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
