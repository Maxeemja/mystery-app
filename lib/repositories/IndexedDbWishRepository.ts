import {
  INDEX_WISHES_BY_USER_CREATED,
  STORE_WISHES,
  request,
  withStore,
} from '../db'
import type { NewWish, Wish, WishPatch } from '../domain/types'
import type { WishRepository } from './types'

/**
 * Stage-1 implementation of `WishRepository` backed by IndexedDB.
 *
 * Returns rows in insertion order from the compound index; presentation order
 * (active first, newest first within each group) is a domain concern and lives
 * in `lib/domain/ordering.ts`, not here.
 */
export class IndexedDbWishRepository implements WishRepository {
  async list(userId: string): Promise<Wish[]> {
    return withStore(STORE_WISHES, 'readonly', async ([store]) => {
      const index = store!.index(INDEX_WISHES_BY_USER_CREATED)
      // Bound to this user only: [userId, -inf] … [userId, +inf].
      const range = IDBKeyRange.bound([userId, -Infinity], [userId, Infinity])
      return request(index.getAll(range) as IDBRequest<Wish[]>)
    })
  }

  async find(userId: string, id: string): Promise<Wish | null> {
    return withStore(STORE_WISHES, 'readonly', async ([store]) => {
      const found = await request(store!.get(id) as IDBRequest<Wish | undefined>)
      // Same rule as the Mongo implementation: a wish belonging to someone else
      // is reported as absent, not as forbidden.
      if (!found || found.userId !== userId) return null
      return found
    })
  }

  /**
   * The 30-wish cap is an account-side rule, so nothing enforces it against
   * this store — but the contract asks for a count, and answering it honestly
   * costs one index read.
   */
  async count(userId: string): Promise<number> {
    return withStore(STORE_WISHES, 'readonly', async ([store]) => {
      const index = store!.index(INDEX_WISHES_BY_USER_CREATED)
      const range = IDBKeyRange.bound([userId, -Infinity], [userId, Infinity])
      return request(index.count(range) as IDBRequest<number>)
    })
  }

  async create(userId: string, data: NewWish): Promise<Wish> {
    const wish: Wish = {
      ...data,
      id: newId(),
      userId,
      isDone: false,
      createdAt: Date.now(),
    }
    return withStore(STORE_WISHES, 'readwrite', async ([store]) => {
      await request(store!.add(wish))
      return wish
    })
  }

  async update(userId: string, id: string, patch: WishPatch): Promise<Wish> {
    return withStore(STORE_WISHES, 'readwrite', async ([store]) => {
      const existing = await request(store!.get(id) as IDBRequest<Wish | undefined>)
      // An owner mismatch is reported as "not found" rather than "forbidden":
      // a distinct error would confirm the id exists on some other account.
      if (!existing || existing.userId !== userId) {
        throw new Error(`Wish ${id} not found`)
      }
      // A patch uses `null` to mean "clear this field" and `undefined` to mean
      // "leave it alone", while the domain type expresses absence as
      // `undefined` only. Spreading the patch directly would store nulls that
      // the UI's `?? fallback` checks do not treat as absent.
      const merged: Record<string, unknown> = { ...existing }
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) continue
        if (value === null) delete merged[key]
        else merged[key] = value
      }
      // Identity is not patchable — re-keying a record onto another account is
      // exactly what the owner scope exists to prevent.
      merged.id = existing.id
      merged.userId = existing.userId

      const next = merged as unknown as Wish
      await request(store!.put(next))
      return next
    })
  }

  async remove(userId: string, id: string): Promise<Wish | null> {
    return withStore(STORE_WISHES, 'readwrite', async ([store]) => {
      const existing = await request(store!.get(id) as IDBRequest<Wish | undefined>)
      if (!existing || existing.userId !== userId) return null
      await request(store!.delete(id))
      // Local wishes hold a Blob, not a Cloudinary id, so nothing downstream
      // will act on this — it is returned only to satisfy the shared contract.
      return existing
    })
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
