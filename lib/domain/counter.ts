/**
 * Header counter — docs/spec.md §4.1, docs/interactions.md §2.1.
 *
 * Format: «3 бажання · 1 здійснене».
 * The counter always describes the whole list, never the filtered subset —
 * that is the caller's responsibility, but it is worth restating here because
 * it is the single easiest thing to get wrong on the hub screen.
 */

import { pluralCategory } from './validation'

const WISH_FORMS = {
  one: 'бажання', // 1, 21, 31…
  few: 'бажання', // 2–4, 22–24…
  many: 'бажань', // 0, 5–20, 25–30…
} as const

const DONE_FORMS = {
  one: 'здійснене',
  few: 'здійснені',
  many: 'здійснених',
} as const

/** «3 бажання» */
export function formatWishCount(total: number): string {
  return `${total} ${WISH_FORMS[pluralCategory(total)]}`
}

/** «1 здійснене» */
export function formatDoneCount(done: number): string {
  return `${done} ${DONE_FORMS[pluralCategory(done)]}`
}

/** «3 бажання · 1 здійснене» */
export function formatCounter(total: number, done: number): string {
  return `${formatWishCount(total)} · ${formatDoneCount(done)}`
}
