import 'server-only'

import { findByShareToken } from '../auth/users'
import { applyFilter, sortWishes, type Wish } from '../domain'
import { wishRepository } from '../repositories/server'

/**
 * Everything `/w/{token}` needs, resolved on the server — docs/stage-2.md §5.3.
 *
 * Completed wishes are dropped here, at the source, rather than in the view.
 * They must be excluded from the count as well as the grid, and filtering in
 * one place makes it impossible for the banner and the cards to disagree.
 */

export interface GuestList {
  ownerId: string
  name: string
  wishes: Wish[]
}

export async function loadGuestList(
  shareToken: string
): Promise<GuestList | null> {
  const owner = await findByShareToken(shareToken)
  if (!owner) return null

  const all = await wishRepository.list(owner.id)
  return {
    ownerId: owner.id,
    name: owner.name,
    wishes: applyFilter(sortWishes(all), 'active'),
  }
}
