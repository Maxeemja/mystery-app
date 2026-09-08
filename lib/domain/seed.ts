/**
 * The three starter wishes — docs/spec.md §2 «Тестові дані»,
 * docs/stage-2.md §6 case 2.
 *
 * Shared rather than duplicated: stage 1 seeds them into IndexedDB for a new
 * local profile, and stage 2 seeds the same three into a brand-new account.
 * Two copies of this list would drift, and the acceptance checklist checks the
 * exact titles and prices.
 *
 * They are ordinary wishes once created — editable, deletable, and counted
 * against the 30-wish limit.
 */

import { DEFAULT_CURRENCY } from './types'
import type { Currency } from './types'

/** One minute apart, so the newest-first ordering is stable and obvious. */
export const SEED_SPACING_MS = 60_000

export interface SeedWish {
  title: string
  emoji: string
  price: number
  currency: Currency
  isDone: boolean
}

/** Listed newest-first; `createdAt` is spaced by the callers accordingly. */
export const SEED_WISHES: SeedWish[] = [
  {
    title: 'Книжка про дизайн',
    emoji: '📚',
    price: 450,
    currency: DEFAULT_CURRENCY,
    isDone: false,
  },
  {
    title: 'Вихідні у Львові',
    emoji: '✈️',
    price: 3000,
    currency: DEFAULT_CURRENCY,
    isDone: false,
  },
  {
    title: 'Навушники',
    emoji: '🎧',
    price: 2200,
    currency: DEFAULT_CURRENCY,
    isDone: true,
  },
]
