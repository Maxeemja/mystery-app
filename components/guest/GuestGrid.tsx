'use client'

/**
 * The guest's card grid on `/w/{token}` — docs/stage-2.md §5.4.
 *
 * ## Why this is a Client Component, and what that costs
 *
 * The rest of this screen is deliberately server-only: `GuestWishCard`'s own
 * comment says the absence of interactivity is what lets the page work with
 * JavaScript disabled. Reservation breaks that, and not because of the inline
 * form — a `<form action={reserveWishAction}>` would handle that with a full
 * reload. It breaks because **one reservation changes every other card**: the
 * moment a guest claims a wish, «Забронювати» has to vanish from all its
 * siblings, which is shared state across the grid rather than state inside the
 * card that was clicked.
 *
 * So: the wishes are still fetched and filtered on the server, the banner, the
 * CTA, the OG tags and the 404 stay server-only, and this grid receives its
 * data as props — a first load is one round trip and is already correct for the
 * incoming cookie. What it does *not* keep is a working reservation flow with
 * scripting off. A no-JS visitor still sees the whole list, the prices, the
 * links and every «Заброньовано: …» badge rendered from the server; the buttons
 * are inert. The read-only screen that §5.3 describes survives intact, the new
 * interactive layer does not. That is the trade, stated rather than discovered.
 *
 * The alternative — real form actions plus a client layer for the cross-fade —
 * would keep the buttons working without JS, but the name field would have to
 * be permanently visible on every free card for a no-JS visitor to fill it in,
 * and the cross-card hiding would still need either a full page reload per
 * click or the same lifted state. It buys a genuinely worse default screen for
 * a case this feature is not used in.
 *
 * ## No optimistic write
 *
 * State is applied when the action resolves, not before. An optimistic
 * «Заброньовано тобою» would be wrong in exactly the situation the feature has
 * to handle well — two guests confirming at once — and the correction would
 * flash a claim and then retract it. Resolving takes one round trip and the
 * card is disabled meanwhile.
 */

import { useCallback, useState } from 'react'

import { ReservableWishCard } from './ReservableWishCard'
import type { Wish } from '../../lib/domain'
import type { ReservationView } from '../../lib/share/guestReservations'
import {
  cancelReservationAction,
  refreshReservationsAction,
  reserveWishAction,
  type ReserveResult,
} from '../../app/actions/reservations'

interface GuestGridProps {
  /** Needed to re-resolve the list when resyncing after a lost race. */
  shareToken: string
  wishes: Wish[]
  initialView: ReservationView
}

export function GuestGrid({ shareToken, wishes, initialView }: GuestGridProps) {
  const [view, setView] = useState(initialView)
  const [namingId, setNamingId] = useState<string | null>(null)

  const resync = useCallback(async () => {
    setView(await refreshReservationsAction(shareToken))
  }, [shareToken])

  const reserve = useCallback(
    async (wishId: string, guestName: string): Promise<ReserveResult> => {
      const result = await reserveWishAction(wishId, guestName)

      if (result.ok) {
        setView((current) => ({
          byWishId: {
            ...current.byWishId,
            [wishId]: { guestName: result.guestName, mine: true },
          },
          holdsReservation: true,
        }))
      } else if (result.reason !== 'invalid-name') {
        // Whatever we thought was true is not. Rather than patch the one card
        // from a guessed value, take the whole list's state from the server —
        // a lost race also means some *other* card is now claimed.
        await resync()
      }

      return result
    },
    [resync]
  )

  const cancel = useCallback(
    async (wishId: string) => {
      const result = await cancelReservationAction(wishId)
      if (!result.ok) {
        await resync()
        return
      }
      setView((current) => {
        const byWishId = { ...current.byWishId }
        delete byWishId[wishId]
        return {
          byWishId,
          // Recomputed rather than assumed false. The view is scoped to the
          // whole list, not to the wishes on screen, so this stays correct if a
          // reservation ever outlives the card it belongs to.
          holdsReservation: Object.values(byWishId).some((r) => r.mine),
        }
      })
    },
    [resync]
  )

  return (
    <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {wishes.map((wish) => (
        <ReservableWishCard
          key={wish.id}
          wish={wish}
          reservation={view.byWishId[wish.id] ?? null}
          holdsReservation={view.holdsReservation}
          naming={namingId === wish.id}
          onOpenPrompt={() => setNamingId(wish.id)}
          onClosePrompt={() => setNamingId(null)}
          onReserve={(guestName) => reserve(wish.id, guestName)}
          onCancel={() => cancel(wish.id)}
        />
      ))}
    </div>
  )
}
