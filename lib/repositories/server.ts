import 'server-only'

/**
 * Server-side repository resolution — MongoDB.
 *
 * The `server-only` import above is the enforcement, not a convention: if a
 * Client Component ever reaches this module, even transitively, `next build`
 * fails with the import trace instead of shipping the driver — and the
 * connection string it reads — to the browser.
 *
 * Callers must pass a `userId` resolved from the session. See the ownership
 * note in `./types` for why that is a contract obligation rather than something
 * these implementations look up themselves.
 */

import { MongoProfileRepository } from './MongoProfileRepository'
import { MongoWishRepository } from './MongoWishRepository'
import type { ProfileRepository } from './types'

export const wishRepository = new MongoWishRepository()
export const profileRepository: ProfileRepository = new MongoProfileRepository()
