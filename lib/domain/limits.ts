/**
 * Account wish limit — docs/stage-2.md §4.
 *
 * The cap exists because of the free cluster's size, not because of product
 * logic. That is exactly why done wishes count too: "completed ones are free"
 * would make sense as a product rule and no sense as a storage rule.
 */

export const WISH_LIMIT = 30

/** Below this the counter looks exactly as it did on stage 1. */
export const LIMIT_INDICATOR_FROM = 25

export const LIMIT_REACHED_TEXT =
  'Ліміт 30 бажань. Видали щось, щоб додати нове'

export function shouldShowLimit(total: number): boolean {
  return total >= LIMIT_INDICATOR_FROM
}

export function isAtLimit(total: number): boolean {
  return total >= WISH_LIMIT
}

/** The muted «28 / 30» that sits beside the counter, never replacing it. */
export function formatLimit(total: number): string {
  return `${total} / ${WISH_LIMIT}`
}

/** «Перенесено 30 з N бажань — це максимум для акаунта» (stage-2.md §6). */
export function migrationTruncatedText(localTotal: number): string {
  return `Перенесено ${WISH_LIMIT} з ${localTotal} бажань — це максимум для акаунта`
}
