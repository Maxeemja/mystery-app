import 'server-only'

import { notFound } from 'next/navigation'

import { requireUserId } from '../auth/session'
import type { Wish } from '../domain'
import { wishRepository } from '../repositories/server'

/**
 * Read path for `/edit/{id}` — docs/prompter-task-edit-wish.md §5, §6.
 *
 * ## What this is, and what it deliberately is not
 *
 * §5 asks for a single `requireOwnedWish` helper and says the existing
 * mutations should be routed through it "if they don't already". They already
 * enforce ownership, by a stronger mechanism: `MongoWishRepository` folds the
 * owner into the query filter (`{_id, userId}`), so a foreign id matches zero
 * documents and the wrong record is never in hand at all.
 *
 * Routing `toggleDone` and `remove` through a fetch-then-compare helper would
 * be a regression, not a consolidation — it would replace "the database cannot
 * return someone else's row" with "we remembered to check after it did". So
 * this helper exists only as the *read* the edit page needs. The mutations keep
 * their filter-level scoping.
 *
 * Missing and foreign resolve identically to a 404. A distinct 403 for a wish
 * that exists but isn't yours turns the route into an oracle for enumerating
 * which ids are real.
 */
export async function requireOwnedWish(id: string): Promise<Wish> {
  const userId = await requireUserId()
  const wish = await wishRepository.find(userId, id)
  // `find` already returns null for a malformed id, so garbage in the URL is a
  // 404 rather than a 500.
  if (!wish) notFound()
  return wish
}
