/**
 * IndexedDB open + a thin promise wrapper.
 *
 * Deliberately dependency-free: the surface actually used here is small, and
 * owning it keeps the migration path (schema.ts) explicit for stage 2.
 */

import { DB_NAME, DB_VERSION, migrate } from './schema'

/**
 * Thrown when the browser has no usable IndexedDB (private browsing on some
 * engines, blocked storage, exhausted quota).
 *
 * The UI contract for this is interactions.md §0.2: show an inline
 * «Не вдалося зберегти» where the action was attempted, keep the app alive,
 * and do not apply the change.
 */
export class StorageUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('IndexedDB is unavailable')
    this.name = 'StorageUnavailableError'
    this.cause = cause
  }
}

let dbPromise: Promise<IDBDatabase> | null = null

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new StorageUnavailableError())
      return
    }

    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch (error) {
      reject(new StorageUnavailableError(error))
      return
    }

    request.onupgradeneeded = (event) => {
      migrate(request.result, event.oldVersion)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new StorageUnavailableError(request.error))
    request.onblocked = () => reject(new StorageUnavailableError())
  })

  // A failed open must not be cached — a later attempt (different tab state,
  // freed quota) should be allowed to try again.
  dbPromise.catch(() => {
    dbPromise = null
  })

  return dbPromise
}

/** Test seam: drops the memoized connection so the next open re-runs. */
export function resetDbConnection(): void {
  dbPromise = null
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new StorageUnavailableError(request.error))
  })
}

/**
 * Runs `work` inside a transaction and resolves once the transaction itself
 * completes — not merely once the request fires. Without waiting for
 * `oncomplete`, a subsequent read can race ahead of an unflushed write.
 */
export async function withStore<T>(
  storeNames: string | string[],
  mode: IDBTransactionMode,
  work: (stores: IDBObjectStore[]) => Promise<T> | T
): Promise<T> {
  const db = await openDb()
  const names = Array.isArray(storeNames) ? storeNames : [storeNames]

  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction
    try {
      tx = db.transaction(names, mode)
    } catch (error) {
      reject(new StorageUnavailableError(error))
      return
    }

    let result: T
    let settled = false

    tx.oncomplete = () => {
      if (!settled) {
        settled = true
        resolve(result)
      }
    }
    tx.onerror = () => {
      if (!settled) {
        settled = true
        reject(new StorageUnavailableError(tx.error))
      }
    }
    tx.onabort = () => {
      if (!settled) {
        settled = true
        reject(new StorageUnavailableError(tx.error))
      }
    }

    Promise.resolve(work(names.map((name) => tx.objectStore(name))))
      .then((value) => {
        result = value
      })
      .catch((error) => {
        settled = true
        try {
          tx.abort()
        } catch {
          // Transaction may already be finished; the rejection below stands.
        }
        reject(
          error instanceof StorageUnavailableError
            ? error
            : new StorageUnavailableError(error)
        )
      })
  })
}

export { promisify as request }
