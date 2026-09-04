/**
 * Domain types — see docs/spec.md §2.
 *
 * This module (and everything else in lib/domain) has zero dependency on React
 * or on the storage layer. It is meant to survive the stage-2 move to a server
 * database without a single edit (docs/tech-stack.md §5).
 */

/** Stage 1 has no auth; every record is owned by this synthetic user. */
export const LOCAL_USER_ID = 'local-user'

export const CURRENCIES = ['UAH', 'PLN', 'USD', 'EUR'] as const
export type Currency = (typeof CURRENCIES)[number]

/** Default currency when a price is entered (spec.md §7, decision 6). */
export const DEFAULT_CURRENCY: Currency = 'UAH'

/** Fallback glyph when the user picks neither an emoji nor an image. */
export const DEFAULT_EMOJI = '🎁'

/** The eight offered emoji (interactions.md §3.2). */
export const EMOJI_CHOICES = [
  '🎁',
  '📚',
  '✈️',
  '🎧',
  '👟',
  '💻',
  '🎮',
  '☕',
] as const

export interface Wish {
  id: string
  userId: string
  title: string
  /** Unicode glyph. Mutually exclusive with `image` (interactions.md §3.3). */
  emoji?: string
  /** Compressed image blob. Mutually exclusive with `emoji`. */
  image?: Blob
  /** Amount without currency. `0` is a valid (free) price. */
  price?: number
  /** Only meaningful when `price` is set. */
  currency?: Currency
  url?: string
  isDone: boolean
  /** Epoch milliseconds — sortable, and indexable in IndexedDB as-is. */
  createdAt: number
}

/** What a caller supplies when creating a wish; the repository fills the rest. */
export interface NewWish {
  title: string
  emoji?: string
  image?: Blob
  price?: number
  currency?: Currency
  url?: string
}

export interface Profile {
  userId: string
  name: string
  /** Always empty on stage 1; the field exists so stage 2 needs no migration. */
  email: string
}
