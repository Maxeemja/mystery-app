'use server'

import { currentUserId } from '../../lib/auth/session'
import { findByShareToken } from '../../lib/auth/users'
import { validateGuestName } from '../../lib/domain'
import {
  generateGuestId,
  issueGuestId,
  readGuestId,
} from '../../lib/guests/guestId'
import {
  deleteReservationByGuest,
  insertReservation,
} from '../../lib/reservations/store'
import {
  EMPTY_RESERVATION_VIEW,
  findReservationHolder,
  loadReservationView,
  resolveReservableWish,
  type ReservationView,
} from '../../lib/share/guestReservations'

/**
 * The guest mutation surface — docs/stage-2.md §5.4.
 *
 * Separate from `app/actions/wishes.ts` on purpose. Those actions resolve an
 * *owner* through `requireUserId()` and every one of them would be a bug if it
 * ran for a guest; these resolve a *guest* through a cookie and would be a bug
 * if they ran for the owner. Keeping them in one file would mean one import
 * away from the owner's screens reaching a reservation query, which is exactly
 * what docs/prompter-task-reservations.md §5 rules out.
 *
 * Results are returned, not thrown. `updateWishAction` established the
 * convention for the same reason it applies here: error identity does not
 * survive the Server Action boundary, and the card has to tell «someone beat
 * you to it» apart from «something broke».
 *
 * Rate limiting is explicitly out of scope (docs/stage-2.md §9).
 */

export type ReserveResult =
  | { ok: true; guestName: string }
  | { ok: false; reason: 'invalid-name' }
  /** No such wish, it is already done, or the caller owns the list. */
  | { ok: false; reason: 'not-found' }
  /** Lost the race on `unique(wishId)`. */
  | { ok: false; reason: 'already-reserved'; reservedBy: string | null }
  /** Lost the race on `unique(listOwnerId, guestId)` — one per list. */
  | { ok: false; reason: 'already-holds' }

export async function reserveWishAction(
  wishId: string,
  rawGuestName: string
): Promise<ReserveResult> {
  // Re-validated here even though «Підтвердити» is disabled on an empty field:
  // the button is a courtesy, this is the boundary.
  const guestName = validateGuestName(rawGuestName)
  if (!guestName.valid) return { ok: false, reason: 'invalid-name' }

  const wish = await resolveReservableWish(wishId)
  if (!wish) return { ok: false, reason: 'not-found' }

  if (await isListOwner(wish.listOwnerId)) return { ok: false, reason: 'not-found' }

  // The id is minted here but only persisted below, after the insert succeeds —
  // §3's «видається лише в момент першого успішного бронювання». A visitor who
  // loses the race leaves with no cookie, exactly as they arrived.
  const existing = await readGuestId()
  const guestId = existing ?? generateGuestId()

  const outcome = await insertReservation({
    wishId,
    listOwnerId: wish.listOwnerId,
    guestId,
    guestName: guestName.value,
  })

  if (!outcome.ok) {
    if (outcome.reason === 'guest-has-one') {
      return { ok: false, reason: 'already-holds' }
    }
    return {
      ok: false,
      reason: 'already-reserved',
      reservedBy: await findReservationHolder(wishId),
    }
  }

  if (!existing) await issueGuestId(guestId)
  return { ok: true, guestName: guestName.value }
}

export type CancelResult = { ok: true } | { ok: false; reason: 'not-found' }

/**
 * No confirmation step, by design — symmetric to the «✓» on the owner's own
 * screen: a light, immediately reversible action (docs/stage-2.md §5.4).
 *
 * The guest id comes from the cookie and is never an argument, so the only
 * reservation a caller can delete is their own.
 */
export async function cancelReservationAction(
  wishId: string
): Promise<CancelResult> {
  const guestId = await readGuestId()
  if (!guestId) return { ok: false, reason: 'not-found' }

  const deleted = await deleteReservationByGuest(wishId, guestId)
  return deleted ? { ok: true } : { ok: false, reason: 'not-found' }
}

/**
 * Re-reads the whole list's reservation state.
 *
 * Used after a lost race: the optimistic guess was wrong, so rather than
 * patching the one card from a guessed value, the grid resyncs from the server.
 *
 * Returns an empty view to the list's owner. Nothing in the UI can call it as
 * the owner — their branch of `/w/{token}` renders no client grid at all — but
 * a Server Action is a public endpoint, and this is the one place where a guest
 * read could otherwise be pointed at an owner.
 */
export async function refreshReservationsAction(
  shareToken: string
): Promise<ReservationView> {
  const owner = await findByShareToken(shareToken)
  if (!owner) return EMPTY_RESERVATION_VIEW
  if (await isListOwner(owner.id)) return EMPTY_RESERVATION_VIEW

  return loadReservationView(owner.id, await readGuestId())
}

async function isListOwner(listOwnerId: string): Promise<boolean> {
  return (await currentUserId()) === listOwnerId
}
