'use client'

/**
 * Three distinct empty states, keyed to (total count, active filter) —
 * docs/interactions.md §2.6.
 *
 * Only the first one is a true "nothing here yet" and gets the «Додати» call to
 * action. The other two mean "your filter hides everything", so the filter row
 * stays on screen above them (the screen handles that) and no button is offered
 * — the fix is to switch the filter back, not to add a wish.
 */

import { ButtonLink } from '../ui/Button'
import type { WishFilter } from '../../lib/domain'

export function EmptyState({
  total,
  filter,
}: {
  total: number
  filter: WishFilter
}) {
  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-5 py-20 text-center">
        <p className="max-w-prose text-subheading text-mid-gray">
          Поки що жодного бажання. Чого тобі хочеться?
        </p>
        <ButtonLink href="/add">Додати</ButtonLink>
      </div>
    )
  }

  const message =
    filter === 'active'
      ? 'Усі бажання здійснені 🎉'
      : 'Ще жодне бажання не здійснене'

  return (
    <div className="flex flex-col items-center py-20 text-center">
      <p className="max-w-prose text-subheading text-mid-gray">{message}</p>
    </div>
  )
}
