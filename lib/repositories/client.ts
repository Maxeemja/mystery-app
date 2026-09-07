/**
 * Client-side repository resolution — IndexedDB.
 *
 * Importable from browser code only. It is kept in its own module (rather than
 * in `./index`) because the barrel is reachable from Server Components, and
 * `IndexedDbWishRepository` constructs against a global that does not exist on
 * the server.
 *
 * From stage 3 on, the only remaining caller is the one-time migration that
 * drains this store into the account. Until then it still backs the running
 * app, which is why the implementation stays in the tree.
 */

import { IndexedDbProfileRepository } from './IndexedDbProfileRepository'
import { IndexedDbWishRepository } from './IndexedDbWishRepository'
import type { ProfileRepository, WishRepository } from './types'

export const localWishRepository: WishRepository = new IndexedDbWishRepository()
export const localProfileRepository: ProfileRepository =
  new IndexedDbProfileRepository()
