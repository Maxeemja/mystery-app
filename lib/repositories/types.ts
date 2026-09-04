/**
 * Repository contracts — docs/tech-stack.md §4.
 *
 * This is the seam that makes stage 2 a data migration rather than a rewrite.
 * Components never touch IndexedDB; they depend on these interfaces only, so
 * swapping in `MongoWishRepository` behind Server Actions changes no caller.
 *
 * `userId` is threaded through every call even though stage 1 always passes
 * `LOCAL_USER_ID`. Dropping it now would mean editing every call site later.
 */

import type { NewWish, Profile, Wish } from '../domain/types'

export interface WishRepository {
  list(userId: string): Promise<Wish[]>
  create(userId: string, data: NewWish): Promise<Wish>
  update(id: string, patch: Partial<Wish>): Promise<Wish>
  remove(id: string): Promise<void>
}

export interface ProfileRepository {
  get(userId: string): Promise<Profile | null>
  save(profile: Profile): Promise<Profile>
}
