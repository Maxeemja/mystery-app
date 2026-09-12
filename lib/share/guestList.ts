import 'server-only'

import { findByShareToken } from '../auth/users'
import { applyFilter, sortWishes, type Wish } from '../domain'
import { wishRepository } from '../repositories/server'

/**
 * Everything `/w/{token}` needs, resolved on the server — docs/stage-2.md §5.3.
 *
 * Completed wishes are dropped here, at the source, rather than in the view.
 * They must be excluded from the count as well as the grid, and filtering in
 * one place makes it impossible for the banner and the cards to disagree.
 *
 * ## This function must never learn about reservations
 *
 * It serves two different viewers: a stranger with the link, and the owner
 * looking at their own list. Only the first may ever see reservation data
 * (docs/prompter-task-reservations.md §5), and the owner's copy of the response
 * must not contain it even hidden — a field filtered out in the template is
 * still one `view-source` away.
 *
 * So the reservation join is not an option on this function, and not a
 * parameter on it either. It lives in `./guestReservations`, which the page
 * calls separately and only on the branch where the viewer is not the owner.
 * What that leaves here is exactly the query the hub already runs —
 * `wishRepository.list(ownerId)` — so the owner's own `/w/{token}` reads
 * through precisely the same path as «Мої бажання» and cannot diverge from it.
 */

export interface GuestList {
  ownerId: string
  name: string
  wishes: Wish[]
}

export async function loadGuestList(
  shareToken: string
): Promise<GuestList | null> {
  const owner = await findByShareToken(shareToken)
  if (!owner) return null

  const all = await wishRepository.list(owner.id)
  return {
    ownerId: owner.id,
    name: owner.name,
    wishes: applyFilter(sortWishes(all), 'active'),
  }
}
