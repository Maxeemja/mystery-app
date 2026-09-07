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
      const next: Wish = { ...existing, ...patch, id: existing.id, userId: existing.userId }
      await request(store!.put(next))
      return next
    })
  }

  async remove(userId: string, id: string): Promise<void> {
    await withStore(STORE_WISHES, 'readwrite', async ([store]) => {
      const existing = await request(store!.get(id) as IDBRequest<Wish | undefined>)
      if (!existing || existing.userId !== userId) return
      await request(store!.delete(id))
    })
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
