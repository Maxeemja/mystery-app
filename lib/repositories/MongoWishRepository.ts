import 'server-only'

import { ObjectId } from 'mongodb'

import { wishesCollection, type WishDoc } from '../db/mongo'
import type { NewWish, Wish, WishPatch } from '../domain/types'
import type { WishRepository } from './types'

/**
 * Stage-2 implementation of `WishRepository` backed by MongoDB.
 *
 * Every query is scoped by `userId` at the filter level rather than fetched and
 * then checked, so a wrong owner matches zero documents instead of relying on a
 * caller to compare afterwards. See the ownership note in `./types`.
 */
export class MongoWishRepository implements WishRepository {
  async list(userId: string): Promise<Wish[]> {
    const owner = toObjectId(userId)
    if (!owner) return []

    const wishes = await wishesCollection()
    const docs = await wishes.find({ userId: owner }).toArray()
    return docs.map(toDomain)
  }

  async find(userId: string, id: string): Promise<Wish | null> {
    const owner = toObjectId(userId)
    const target = toObjectId(id)
    if (!owner || !target) return null

    const wishes = await wishesCollection()
    // Owner folded into the filter, exactly as in `update` and `remove`: a
    // foreign id matches zero documents rather than being fetched and then
    // compared, so there is no window in which the wrong document is in hand.
    const doc = await wishes.findOne({ _id: target, userId: owner })
    return doc ? toDomain(doc) : null
  }

  async create(userId: string, data: NewWish): Promise<Wish> {
    const owner = toObjectId(userId)
    if (!owner) throw new Error('Invalid user id')

    const doc: WishDoc = {
      _id: new ObjectId(),
      userId: owner,
      title: data.title,
      emoji: data.emoji ?? '🎁',
      imageUrl: data.imageUrl ?? null,
      imagePublicId: data.imagePublicId ?? null,
      price: data.price ?? null,
      currency: data.currency ?? null,
      url: data.url ?? null,
      isDone: false,
      createdAt: new Date(),
    }

    const wishes = await wishesCollection()
    await wishes.insertOne(doc)
    return toDomain(doc)
  }

  async update(userId: string, id: string, patch: WishPatch): Promise<Wish> {
    const owner = toObjectId(userId)
    const target = toObjectId(id)
    // An owner mismatch and a missing id are reported identically: a distinct
    // "forbidden" would confirm the id exists on some other account.
    if (!owner || !target) throw new Error(`Wish ${id} not found`)

    const wishes = await wishesCollection()
    const updated = await wishes.findOneAndUpdate(
      { _id: target, userId: owner },
      { $set: toDocPatch(patch) },
      { returnDocument: 'after' }
    )
    if (!updated) throw new Error(`Wish ${id} not found`)
    return toDomain(updated)
  }

  async remove(userId: string, id: string): Promise<Wish | null> {
    const owner = toObjectId(userId)
    const target = toObjectId(id)
    if (!owner || !target) return null

    const wishes = await wishesCollection()
    // findOneAndDelete rather than deleteOne: the caller needs the doomed
    // document's `imagePublicId` to clean up Cloudinary, and doing it in one
    // atomic step means two concurrent deletes can't both claim the same file.
    const deleted = await wishes.findOneAndDelete({ _id: target, userId: owner })
    return deleted ? toDomain(deleted) : null
  }

  /** Backs the stage-3 hard limit; counts done wishes too (docs/stage-2.md §4). */
  async count(userId: string): Promise<number> {
    const owner = toObjectId(userId)
    if (!owner) return 0

    const wishes = await wishesCollection()
    return wishes.countDocuments({ userId: owner })
  }
}

/**
 * A malformed id is a miss, not a crash. These strings reach us from URLs and
 * from Server Action arguments, so `new ObjectId(garbage)` would otherwise turn
 * any bad input into a 500.
 */
function toObjectId(value: string): ObjectId | null {
  return ObjectId.isValid(value) ? new ObjectId(value) : null
}

function toDomain(doc: WishDoc): Wish {
  // Mongo stores every optional field as an explicit `null`; the domain type
  // uses absence. Collapsing the two here keeps `null` out of the UI, which
  // renders on `undefined` checks.
  return {
    id: doc._id.toHexString(),
    userId: doc.userId.toHexString(),
    title: doc.title,
    isDone: doc.isDone,
    createdAt: doc.createdAt.getTime(),
    ...(doc.emoji ? { emoji: doc.emoji } : {}),
    ...(doc.imageUrl ? { imageUrl: doc.imageUrl } : {}),
    ...(doc.imagePublicId ? { imagePublicId: doc.imagePublicId } : {}),
    ...(doc.price !== null ? { price: doc.price } : {}),
    ...(doc.currency ? { currency: doc.currency } : {}),
    ...(doc.url ? { url: doc.url } : {}),
  }
}

function toDocPatch(patch: WishPatch): Partial<WishDoc> {
  const set: Partial<WishDoc> = {}
  if (patch.title !== undefined) set.title = patch.title
  if (patch.emoji !== undefined) set.emoji = patch.emoji
  if (patch.imageUrl !== undefined) set.imageUrl = patch.imageUrl ?? null
  if (patch.imagePublicId !== undefined) {
    set.imagePublicId = patch.imagePublicId ?? null
  }
  if (patch.price !== undefined) set.price = patch.price ?? null
  if (patch.currency !== undefined) set.currency = patch.currency ?? null
  if (patch.url !== undefined) set.url = patch.url ?? null
  if (patch.isDone !== undefined) set.isDone = patch.isDone
  if (patch.createdAt !== undefined) set.createdAt = new Date(patch.createdAt)
  return set
}
