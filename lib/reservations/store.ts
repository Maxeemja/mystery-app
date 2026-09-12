import 'server-only'

import { ObjectId } from 'mongodb'

import { reservationsCollection } from '../db/mongo'

/**
 * Reservation writes — docs/stage-2.md §5.4.
 *
 * Deliberately *not* part of `WishRepository`. A reservation is not a wish: it
 * belongs to a guest who has no account, it does not count toward the 30-wish
 * limit, and it must never be reachable from the owner's read path. Folding it
 * into the repository the hub already uses would put the join one autocomplete
 * away from the exact leak §5 is about.
 *
 * This module holds writes only. The guest read/join lives in
 * `lib/share/guestReservations.ts`, which nothing on the owner's side imports.
 */

/** Mongo's duplicate-key error — the same code `lib/auth/users.ts` catches. */
const DUPLICATE_KEY = 11000

export type InsertOutcome =
  | { ok: true }
  /** The `unique(wishId)` index rejected it: someone else got there first. */
  | { ok: false; reason: 'wish-taken' }
  /** The `unique(listOwnerId, guestId)` index rejected it: one per list. */
  | { ok: false; reason: 'guest-has-one' }

export async function insertReservation(input: {
  wishId: string
  listOwnerId: string
  guestId: string
  guestName: string
}): Promise<InsertOutcome> {
  const wishId = toObjectId(input.wishId)
  const listOwnerId = toObjectId(input.listOwnerId)
  // Both ids come from a document this request already read, so a malformed one
  // is a programming error rather than bad input — unlike the wish repository,
  // which takes ids straight off a URL and treats garbage as a miss.
  if (!wishId || !listOwnerId) throw new Error('Invalid reservation ids')

  const reservations = await reservationsCollection()
  try {
    await reservations.insertOne({
      _id: new ObjectId(),
      wishId,
      listOwnerId,
      guestId: input.guestId,
      guestName: input.guestName,
      createdAt: new Date(),
    })
    return { ok: true }
  } catch (error) {
    // Which constraint failed decides which message the guest sees, so the two
    // are told apart by the rejected index's key pattern rather than both
    // collapsing into a generic failure.
    const key = duplicateKeyPattern(error)
    if (!key) throw error
    return { ok: false, reason: 'wishId' in key ? 'wish-taken' : 'guest-has-one' }
  }
}

/**
 * Cancel — scoped by `guestId` in the filter itself, the same shape
 * `MongoWishRepository` uses for owner scoping. A guest id that does not hold
 * this reservation matches zero documents; nothing is read and then compared.
 */
export async function deleteReservationByGuest(
  wishId: string,
  guestId: string
): Promise<boolean> {
  const target = toObjectId(wishId)
  if (!target) return false

  const reservations = await reservationsCollection()
  const result = await reservations.deleteOne({ wishId: target, guestId })
  return result.deletedCount > 0
}

/**
 * Cascade — docs/stage-2.md §5.4's edge-case table. Called after a wish is
 * deleted or marked done, never before: the wish mutation is the thing the
 * owner asked for, and it must not be held hostage by a dependent cleanup.
 */
export async function deleteReservationsForWish(wishId: string): Promise<number> {
  const target = toObjectId(wishId)
  if (!target) return 0

  const reservations = await reservationsCollection()
  const result = await reservations.deleteMany({ wishId: target })
  return result.deletedCount
}

function toObjectId(value: string): ObjectId | null {
  return ObjectId.isValid(value) ? new ObjectId(value) : null
}

function duplicateKeyPattern(error: unknown): Record<string, unknown> | null {
  if (typeof error !== 'object' || error === null) return null
  const candidate = error as { code?: number; keyPattern?: Record<string, unknown> }
  if (candidate.code !== DUPLICATE_KEY) return null
  return candidate.keyPattern ?? {}
}
