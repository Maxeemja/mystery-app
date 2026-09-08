/**
 * First-run bootstrap — docs/tech-stack.md §6, docs/spec.md §2 (test data).
 *
 * The seed wishes are inserted at exactly one moment: when a profile is created
 * for the first time. They are deliberately NOT inserted whenever the wish
 * store happens to be empty — otherwise they would reappear after the user
 * deletes everything by hand, which reads as a bug.
 *
 * Stage 2 keeps this for the local store only; the account-side equivalent
 * lives in lib/migration/bootstrapAccount.ts and seeds the same shared list.
 */

import { LOCAL_USER_ID, type Profile } from '../domain/types'
import { SEED_SPACING_MS, SEED_WISHES } from '../domain/seed'
import type { ProfileRepository, WishRepository } from './types'

/**
 * Creates the profile and its seed wishes together.
 *
 * The profile is written last: if seeding fails halfway, the next launch still
 * sees "no profile" and shows Init again, rather than landing the user on a
 * half-populated list with no way to retry.
 */
export async function createProfileWithSeed(
  name: string,
  repos: { profiles: ProfileRepository; wishes: WishRepository }
): Promise<Profile> {
  const now = Date.now()

  for (const [index, seed] of SEED_WISHES.entries()) {
    const { isDone, ...data } = seed
    const created = await repos.wishes.create(LOCAL_USER_ID, data)
    // `create` stamps `createdAt = now` for all three, which would leave the
    // order undefined. Space them explicitly instead.
    await repos.wishes.update(LOCAL_USER_ID, created.id, {
      createdAt: now - index * SEED_SPACING_MS,
      isDone,
    })
  }

  return repos.profiles.save({
    userId: LOCAL_USER_ID,
    name,
    email: '', // stage 2 fills this in; the field exists now to avoid a migration
  })
}
