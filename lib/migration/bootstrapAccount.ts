import 'server-only'

import { ObjectId } from 'mongodb'

import { usersCollection, wishesCollection, type WishDoc } from '../db/mongo'
import {
  SEED_SPACING_MS,
  SEED_WISHES,
  WISH_LIMIT,
  type Currency,
} from '../domain'

/**
 * One-time account bootstrap — docs/stage-2.md §6.
 *
 * Three cases, decided by what the browser's IndexedDB held at first sign-in:
 * local wishes get migrated (and the defaults are *not* created), no local
 * wishes means the three defaults, and more than 30 local wishes migrates the
 * oldest 30 and reports the rest as dropped.
 *
 * ## Idempotency
 *
 * Every migrated document carries `migratedFromLocalId`, the IndexedDB id it
 * came from, and a partial unique index on `(userId, migratedFromLocalId)`
 * enforces one document per local id. Re-running an interrupted migration
 * therefore tops up what is missing and cannot duplicate what already landed —
 * the guarantee comes from the index, not from the loop below being careful.
 *
 * `bootstrappedAt` on the user is set only after the work succeeds, so a
 * half-finished run is retried rather than remembered as complete.
 */

export interface LocalWishInput {
  localId: string
  title: string
  emoji?: string
  price?: number
  currency?: Currency
  url?: string
  isDone: boolean
  createdAt: number
  /** Set when the local wish had a Blob image that was uploaded first. */
  imageUrl?: string
  imagePublicId?: string
}

export interface BootstrapResult {
  /** Already bootstrapped — nothing was done. */
  skipped: boolean
  seeded: boolean
  migrated: number
  /** How many local wishes existed, when more than the limit were offered. */
  droppedFrom?: number
}

/** Cheap pre-check so the client knows whether to read IndexedDB at all. */
export async function isBootstrapped(userId: string): Promise<boolean> {
  const users = await usersCollection()
  const user = await users.findOne(
    { _id: new ObjectId(userId) },
    { projection: { bootstrappedAt: 1 } }
  )
  return Boolean(user?.bootstrappedAt)
}

export async function bootstrapAccount(
  userId: string,
  local: LocalWishInput[]
): Promise<BootstrapResult> {
  const owner = new ObjectId(userId)

  if (await isBootstrapped(userId)) {
    return { skipped: true, seeded: false, migrated: 0 }
  }

  const result =
    local.length > 0
      ? await migrateLocal(owner, local)
      : await seedDefaults(owner)

  await markBootstrapped(owner)
  return result
}

async function migrateLocal(
  owner: ObjectId,
  local: LocalWishInput[]
): Promise<BootstrapResult> {
  // Oldest first, so "the first 30" is a stable, explainable subset rather than
  // whatever order the browser happened to return.
  const ordered = [...local].sort((a, b) => a.createdAt - b.createdAt)
  const kept = ordered.slice(0, WISH_LIMIT)

  const wishes = await wishesCollection()
  let migrated = 0

  for (const item of kept) {
    const doc: WishDoc = {
      _id: new ObjectId(),
      userId: owner,
      title: item.title,
      emoji: item.emoji ?? '🎁',
      imageUrl: item.imageUrl ?? null,
      imagePublicId: item.imagePublicId ?? null,
      price: item.price ?? null,
      currency: item.currency ?? null,
      url: item.url ?? null,
      isDone: item.isDone,
      createdAt: new Date(item.createdAt),
      migratedFromLocalId: item.localId,
    }

    try {
      await wishes.insertOne(doc)
      migrated += 1
    } catch (error) {
      // Duplicate key means a previous, interrupted run already migrated this
      // one. That is success, not failure — skip it and carry on.
      if (!isDuplicateKey(error)) throw error
    }
  }

  return {
    skipped: false,
    seeded: false,
    migrated,
    ...(ordered.length > WISH_LIMIT ? { droppedFrom: ordered.length } : {}),
  }
}

async function seedDefaults(owner: ObjectId): Promise<BootstrapResult> {
  const wishes = await wishesCollection()
  const now = Date.now()

  const docs: WishDoc[] = SEED_WISHES.map((seed, index) => ({
    _id: new ObjectId(),
    userId: owner,
    title: seed.title,
    emoji: seed.emoji,
    imageUrl: null,
    imagePublicId: null,
    price: seed.price,
    currency: seed.currency,
    url: null,
    isDone: seed.isDone,
    // Spaced so the newest-first ordering is deterministic, matching the
    // local bootstrap's behavior.
    createdAt: new Date(now - index * SEED_SPACING_MS),
  }))

  await wishes.insertMany(docs)
  return { skipped: false, seeded: true, migrated: 0 }
}

async function markBootstrapped(owner: ObjectId): Promise<void> {
  const users = await usersCollection()
  await users.updateOne({ _id: owner }, { $set: { bootstrappedAt: new Date() } })
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  )
}
