/**
 * The only place the app is allowed to pick a storage implementation.
 *
 * Screens import `wishRepository` / `profileRepository` and see nothing but the
 * interfaces from `./types`. Stage 2 swaps the two right-hand sides here for
 * Mongo-backed implementations and nothing else changes.
 */

import { IndexedDbProfileRepository } from './IndexedDbProfileRepository'
import { IndexedDbWishRepository } from './IndexedDbWishRepository'
import type { ProfileRepository, WishRepository } from './types'

export const wishRepository: WishRepository = new IndexedDbWishRepository()
export const profileRepository: ProfileRepository =
  new IndexedDbProfileRepository()

export { createProfileWithSeed } from './bootstrap'
export { IndexedDbProfileRepository, IndexedDbWishRepository }
export type { ProfileRepository, WishRepository } from './types'
