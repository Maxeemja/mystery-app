/**
 * Share text template — docs/interactions.md §4.2. Must match exactly:
 *
 *   Список бажань Марʼяни:
 *
 *   📚 Книжка про дизайн — ₴450
 *   ✈️ Вихідні у Львові — ₴3 000
 *
 * A wish with no price is just the emoji and title; a wish with a url gets it
 * appended at the end of the line. No decoration beyond this — the header line
 * is not itself a heading, just plain text ending in a colon.
 */

import { DEFAULT_EMOJI, formatPrice, type Wish } from '../domain'

export function buildShareText(name: string, wishes: readonly Wish[]): string {
  const lines = wishes.map((wish) => {
    let line = `${wish.emoji ?? DEFAULT_EMOJI} ${wish.title}`
    const price = formatPrice(wish.price, wish.currency)
    if (price) line += ` — ${price}`
    if (wish.url) line += ` ${wish.url}`
    return line
  })
  return [`Список бажань ${name}:`, '', ...lines].join('\n')
}
