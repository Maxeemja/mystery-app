/**
 * IndexedDB schema — docs/tech-stack.md §2, §5.
 *
 * IndexedDB rather than localStorage because a wish image may be up to 5MB:
 * localStorage stores strings only (base64 = +33%) against a 5–10MB
 * whole-origin quota, and its API is synchronous.
 */

export const DB_NAME = 'wishlist'
export const DB_VERSION = 1

export const STORE_WISHES = 'wishes'
export const STORE_PROFILES = 'profiles'

/** Wishes for one user, already ordered by `createdAt` ascending. */
export const INDEX_WISHES_BY_USER_CREATED = 'by-user-createdAt'

/**
 * Applies the schema for a given upgrade step.
 *
 * Written as a switch fallthrough so that a browser sitting on any older
 * version walks forward through every migration in turn. Stage 2 will add
 * `case 1:` here rather than editing the store creation above it.
 */
export function migrate(db: IDBDatabase, oldVersion: number): void {
  switch (oldVersion) {
    case 0: {
      const wishes = db.createObjectStore(STORE_WISHES, { keyPath: 'id' })
      wishes.createIndex(INDEX_WISHES_BY_USER_CREATED, ['userId', 'createdAt'])
      db.createObjectStore(STORE_PROFILES, { keyPath: 'userId' })
    }
    // falls through — each future case picks up from the previous version
  }
}
