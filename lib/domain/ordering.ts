/**
 * List ordering — docs/interactions.md §2.4.
 *
 * Active wishes on top, completed below, no separator — one continuous list.
 * Within each group: newest `createdAt` first.
 *
 * Unchecking a wish therefore returns it to its `createdAt` position, not to
 * wherever it happened to sit before it was checked. That is intentional and
 * is why sorting is derived here rather than stored as an order field.
 */

import type { Wish } from './types'

export function sortWishes(wishes: readonly Wish[]): Wish[] {
  return [...wishes].sort((a, b) => {
    if (a.isDone !== b.isDone) return a.isDone ? 1 : -1
    return b.createdAt - a.createdAt
  })
}

export type WishFilter = 'all' | 'active' | 'done'

/** Filter is a view concern only — it never affects the header counter. */
export function applyFilter(wishes: readonly Wish[], filter: WishFilter): Wish[] {
  if (filter === 'active') return wishes.filter((w) => !w.isDone)
  if (filter === 'done') return wishes.filter((w) => w.isDone)
  return [...wishes]
}

export function countDone(wishes: readonly Wish[]): number {
  return wishes.reduce((n, w) => (w.isDone ? n + 1 : n), 0)
}
