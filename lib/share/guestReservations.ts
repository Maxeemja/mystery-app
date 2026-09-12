import 'server-only'

import { ObjectId } from 'mongodb'

import { reservationsCollection, wishesCollection } from '../db/mongo'

/**
 * The guest-only reservation read — docs/prompter-task-reservations.md §5.
 *
 * ## Why this is its own module
 *
 * §5 is not a UI rule, it is a rule about which query runs. The owner must not
 * merely fail to *see* reservations; the response that carries their wishes
 * must not contain them. That is easy to state and easy to lose: the previous
 * shape of this feature's obvious implementation is a single `loadGuestList`
 * with an `if (!isOwner)` around a badge in the template, and a template
 * condition is one careless refactor away from disappearing.
 *
 * So the join lives here, in a module that nothing on the owner's side has any
 * reason to import — not `components/WishlistScreen.tsx`, not
 * `app/actions/wishes.ts`, not `lib/repositories/*`. The owner's two read paths
 * (the hub, and their own `/w/{token}`) both go through
 * `wishRepository.list(userId)` and `loadGuestList`, neither of which can reach
 * this file. The isolation is structural rather than a comment asking for
 * discipline: to leak a reservation into an owner response you would have to
 * add an import that does not exist.
 *
 * The writes live in `lib/reservations/store.ts` instead, because the cascades
 * genuinely do belong on the owner's delete/done actions.
 */

export interface WishReservation {
  guestName: string
  /** True when the viewing guest's cookie matches this reservation. */
  mine: boolean
}

export interface ReservationView {
  /** Keyed by wish id. A wish absent from this map is unreserved. */
  byWishId: Record<string, WishReservation>
  /** Whether this guest already holds a reservation somewhere on this list. */
  holdsReservation: boolean
}

export const EMPTY_RESERVATION_VIEW: ReservationView = {
  byWishId: {},
  holdsReservation: false,
}

/**
 * Every reservation on one owner's list, resolved against the viewer's cookie.
 *
 * Scoped by `listOwnerId` rather than by the ids of the wishes being rendered,
 * because `holdsReservation` has to be true even when the guest's one
 * reservation sits on a wish that is not on screen — a wish the owner has since
 * marked done disappears from the grid, and a stale "you may reserve" button
 * would then just fail against the unique index.
 *
 * `guestId` is never returned to the caller in any form. The client gets a
 * boolean per card, not an identity it could replay.
 */
export async function loadReservationView(
  listOwnerId: string,
  guestId: string | null
): Promise<ReservationView> {
  const owner = toObjectId(listOwnerId)
  if (!owner) return EMPTY_RESERVATION_VIEW

  const reservations = await reservationsCollection()
  const docs = await reservations
    .find({ listOwnerId: owner }, { projection: { wishId: 1, guestId: 1, guestName: 1 } })
    .toArray()

  const byWishId: Record<string, WishReservation> = {}
  let holdsReservation = false

  for (const doc of docs) {
    const mine = guestId !== null && doc.guestId === guestId
    if (mine) holdsReservation = true
    byWishId[doc.wishId.toHexString()] = { guestName: doc.guestName, mine }
  }

  return { byWishId, holdsReservation }
}

/**
 * Resolves the list a wish belongs to, for the reserve action.
 *
 * Unscoped by viewer on purpose — a guest owns nothing, so there is no owner to
 * scope by; the share token is what granted access to this list in the first
 * place. Done wishes resolve to null because they are not on the guest screen
 * at all (docs/stage-2.md §5.3), so a reservation against one could only come
 * from a direct action call.
 */
export async function resolveReservableWish(
  wishId: string
): Promise<{ listOwnerId: string } | null> {
  const target = toObjectId(wishId)
  if (!target) return null

  const wishes = await wishesCollection()
  const doc = await wishes.findOne(
    { _id: target, isDone: false },
    { projection: { userId: 1 } }
  )
  return doc ? { listOwnerId: doc.userId.toHexString() } : null
}

/** Who currently holds a wish, for the message the loser of a race gets. */
export async function findReservationHolder(
  wishId: string
): Promise<string | null> {
  const target = toObjectId(wishId)
  if (!target) return null

  const reservations = await reservationsCollection()
  const doc = await reservations.findOne(
    { wishId: target },
    { projection: { guestName: 1 } }
  )
  return doc?.guestName ?? null
}

function toObjectId(value: string): ObjectId | null {
  return ObjectId.isValid(value) ? new ObjectId(value) : null
}
