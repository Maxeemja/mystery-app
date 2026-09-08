/**
 * Domain types — see docs/spec.md §2.
 *
 * This module (and everything else in lib/domain) has zero dependency on React
 * or on the storage layer. It is meant to survive the stage-2 move to a server
 * database without a single edit (docs/tech-stack.md §5).
 */

/**
 * Owner of every IndexedDB record. Stage 1 had no auth, so this was *the* user;
 * from stage 2 on it only ever scopes the local store that stage 3's migration
 * drains. Account-backed records are owned by a real Mongo `ObjectId`.
 */
export const LOCAL_USER_ID = 'local-user'

export const CURRENCIES = ['UAH', 'PLN', 'USD', 'EUR'] as const
export type Currency = (typeof CURRENCIES)[number]

/** Default currency when a price is entered (spec.md §7, decision 6). */
export const DEFAULT_CURRENCY: Currency = 'UAH'

/** Fallback glyph when the user picks neither an emoji nor an image. */
export const DEFAULT_EMOJI = '🎁'

/**
 * The offered emoji (interactions.md §3.2).
 *
 * The original eight covered gifts, books, travel, audio, shoes, tech, games
 * and coffee. The five added below fill the obvious gaps rather than adding
 * more of the same: self-care, home/plants, sport, food and hobbies. One glyph
 * per category — the picker is a shortcut for the common case, not a catalogue,
 * and a long grid would slow down the decision it exists to speed up.
 *
 * The row wraps, so growing this list needs no layout change.
 */
export const EMOJI_CHOICES = [
  '🎁',
  '📚',
  '✈️',
  '🎧',
  '👟',
  '💻',
  '🎮',
  '☕',
  '🧴',
  '🪴',
  '🚲',
  '🍰',
  '🎨',
] as const

export interface Wish {
  id: string
  userId: string
  title: string
  /** Unicode glyph. Mutually exclusive with `image` (interactions.md §3.3). */
  emoji?: string
  /**
   * Compressed image blob — IndexedDB only. Stage 2 stores images in Cloudinary
   * instead; this field survives solely so stage 3's migration can read the
   * blobs it needs to upload.
   */
  image?: Blob
  /** Cloudinary `secure_url`. Mutually exclusive with `emoji`. */
  imageUrl?: string
  /**
   * Cloudinary `public_id`. Always written alongside `imageUrl` — without it the
   * file cannot be destroyed and a deleted wish leaks its image forever
   * (docs/stage-2.md §7).
   */
  imagePublicId?: string
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
  imageUrl?: string
  imagePublicId?: string
  price?: number
  currency?: Currency
  url?: string
}

/**
 * What a caller may change on an existing wish.
 *
 * Deliberately narrower than `Partial<Wish>`: `id` and `userId` are identity,
 * not data. Allowing them in a patch would let a mutation re-key a record onto
 * another account — the exact thing the owner scope on every repository call is
 * there to prevent. `createdAt` stays patchable because seeding and stage-3
 * migration both need to preserve original timestamps.
 */
export type WishPatch = Partial<{
  title: string
  emoji: string
  /**
   * The optional value fields accept `null` as well as a value, because editing
   * has to be able to *clear* them — emptying the price field, or removing an
   * image with «×». `Partial<Omit<Wish, …>>` could only ever say "leave this
   * alone" (`undefined`) or "set it", never "unset it", which made the
   * implementations' own `?? null` handling unreachable.
   */
  image: Blob | null
  imageUrl: string | null
  imagePublicId: string | null
  price: number | null
  currency: Currency | null
  url: string | null
  isDone: boolean
  createdAt: number
}>

export interface Profile {
  userId: string
  name: string
  /** Always empty on stage 1; the field exists so stage 2 needs no migration. */
  email: string
}
