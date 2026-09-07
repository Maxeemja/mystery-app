/**
 * Repository barrel — **types and contracts only, no implementation**.
 *
 * Stage 1's version of this file constructed the IndexedDB singletons here and
 * claimed stage 2 would just swap the two right-hand sides. That turned out not
 * to hold. `new IndexedDbWishRepository()` runs at import time against a global
 * the server does not have, and stage 2 introduces genuinely server-only
 * callers — Server Actions, and the fully server-rendered guest screen at
 * `/w/{token}`. One module cannot resolve for both sides.
 *
 * So resolution is split by environment and this barrel carries nothing at
 * runtime, which is what makes it safe to import from either side:
 *
 * - `./client` — IndexedDB. Browser only.
 * - `./server` — MongoDB. Guarded by `server-only`, so a client import is a
 *   build error rather than a leaked connection string.
 */

export type { ProfileRepository, WishRepository } from './types'
