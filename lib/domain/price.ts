/**
 * Price formatting — docs/interactions.md §2.3, §3.4.
 *
 * Thousands separator is a plain space, matching the mockups and the share
 * text template («₴3 000»). A non-breaking space would read better in the UI
 * but would leak an invisible U+00A0 into the clipboard/share payload, so the
 * plain space wins.
 */

import type { Currency } from './types'

const SEPARATOR = ' '

/**
 * Symbol and its side. UAH/USD/EUR prefix; PLN is written after the amount,
 * which is the correct convention for złoty.
 */
const CURRENCY_FORMAT: Record<Currency, { symbol: string; suffix: boolean }> = {
  UAH: { symbol: '₴', suffix: false },
  USD: { symbol: '$', suffix: false },
  EUR: { symbol: '€', suffix: false },
  PLN: { symbol: 'zł', suffix: true },
}

/** `3000` → `3 000` */
export function groupThousands(amount: number): string {
  const digits = Math.trunc(Math.abs(amount)).toString()
  let out = ''
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += SEPARATOR
    out += digits[i]
  }
  return out
}

/**
 * `450, 'UAH'` → `₴450`
 *
 * Returns `null` when there is no price, so callers can simply skip rendering
 * the line — a price is optional and `0` is a legitimate value.
 */
export function formatPrice(
  price: number | undefined,
  currency: Currency | undefined
): string | null {
  if (price === undefined || price === null || Number.isNaN(price)) return null
  const format = CURRENCY_FORMAT[currency ?? 'UAH']
  const amount = groupThousands(price)
  return format.suffix
    ? `${amount}${SEPARATOR}${format.symbol}`
    : `${format.symbol}${amount}`
}

/**
 * Live formatting for the price input as the user types (interactions.md §3.4).
 * Strips everything that is not a digit, then regroups: `3000` → `3 000`.
 * An empty string stays empty so the field can be cleared.
 */
export function formatPriceInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  if (digits === '') return ''
  return groupThousands(Number(digits))
}

/** Reads the numeric value back out of a formatted input. */
export function parsePriceInput(formatted: string): number | undefined {
  const digits = formatted.replace(/\D/g, '')
  if (digits === '') return undefined
  return Number(digits)
}
