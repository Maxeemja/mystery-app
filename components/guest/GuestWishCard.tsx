/**
 * Read-only card for `/w/{token}` — docs/stage-2.md §5.3.
 *
 * A Server Component with no interactivity at all, which is what lets this
 * branch of the guest screen work with JavaScript disabled. No «✓», no delete,
 * no hover controls — and, since the reservation feature, no reservation
 * badge or button either.
 *
 * This is now specifically the **owner's** view of their own share link, plus
 * the card of any list with nothing to reserve. The guest's cards go through
 * `ReservableWishCard`, which is a Client Component. Keeping the two apart is
 * what makes docs/prompter-task-reservations.md §5 structural: this file has no
 * import that could reach the `reservations` collection.
 *
 * The «Подивитися →» link is a deliberate departure from the owner's own Share
 * screen, which shows emoji, title and price only (spec.md §3.3). A guest is
 * looking at the list in order to buy something, and without the URL they have
 * to go and find the product themselves.
 */

import { GUEST_CARD_CLASS, GuestWishContent } from './GuestWishContent'
import type { Wish } from '../../lib/domain'

export function GuestWishCard({ wish }: { wish: Wish }) {
  return (
    <div className={GUEST_CARD_CLASS}>
      <GuestWishContent wish={wish} />
    </div>
  )
}
