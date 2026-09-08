import 'server-only'

import { MongoClient, type Collection, type Db, type ObjectId } from 'mongodb'

import type { Currency } from '../domain/types'

/**
 * The single MongoDB client for the whole process.
 *
 * `MongoClient` owns a connection pool, so constructing one per request would
 * exhaust an M0 cluster's connection cap almost immediately. Two things fight
 * against having exactly one: the dev server re-evaluates modules on every hot
 * reload, and a serverless platform re-uses a warm container across
 * invocations. Both are handled by hanging the promise off `globalThis` — the
 * module scope is recreated on reload, the global is not.
 *
 * The *promise* is cached rather than the resolved client so that concurrent
 * callers during a cold start share one in-flight connect instead of racing to
 * open several.
 */

const DB_NAME = 'wishlist'

export const COLLECTION_USERS = 'users'
export const COLLECTION_WISHES = 'wishes'

/** Shape of a `users` document — docs/stage-2.md §2. */
export interface UserDoc {
  _id: ObjectId
  email: string
  passwordHash: string
  name: string
  shareToken: string
  createdAt: Date
  /**
   * When the account's one-time bootstrap finished — either the stage-1 local
   * data was migrated in, or the three defaults were seeded (docs/stage-2.md
   * §6).
   *
   * Without this the two cases can't be told apart on a later login: once
   * IndexedDB has been drained and cleared, a returning user looks exactly
   * like a brand-new one, and the defaults would be re-seeded on every visit.
   * It is set only after the work succeeds, so an interrupted migration
   * retries on the next login instead of being written off as done.
   */
  bootstrappedAt?: Date
}

/** Shape of a `wishes` document — docs/stage-2.md §2. */
export interface WishDoc {
  _id: ObjectId
  userId: ObjectId
  title: string
  emoji: string
  imageUrl: string | null
  imagePublicId: string | null
  price: number | null
  currency: Currency | null
  url: string | null
  isDone: boolean
  createdAt: Date
  /**
   * The IndexedDB `id` this document was migrated from, when it was. Stage 3
   * keys migration idempotency on it. Absent on every natively-created wish, so
   * it can never be confused with real wish data.
   */
  migratedFromLocalId?: string
}

declare global {
  // eslint-disable-next-line no-var
  var __wishlistMongo: Promise<MongoClient> | undefined
}

function connect(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Copy .env.example to .env.local and fill it in.'
    )
  }
  return new MongoClient(uri).connect()
}

export function getMongoClient(): Promise<MongoClient> {
  globalThis.__wishlistMongo ??= connect()
  return globalThis.__wishlistMongo
}

export async function getDb(): Promise<Db> {
  return (await getMongoClient()).db(DB_NAME)
}

export async function usersCollection(): Promise<Collection<UserDoc>> {
  return (await getDb()).collection<UserDoc>(COLLECTION_USERS)
}

export async function wishesCollection(): Promise<Collection<WishDoc>> {
  return (await getDb()).collection<WishDoc>(COLLECTION_WISHES)
}
