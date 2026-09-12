/**
 * Validation rules — docs/interactions.md §1.1, §2.7, §3.1.
 *
 * Both the Init screen and the name-edit modal use the exact same name rules,
 * so they live here once rather than being reimplemented per screen.
 */

export const NAME_MIN_LENGTH = 3
export const NAME_MAX_LENGTH = 15
export const TITLE_MAX_LENGTH = 60

export interface ValidationResult {
  /** The trimmed value that should actually be persisted. */
  value: string
  valid: boolean
}

/**
 * Name: trimmed, 3–15 characters.
 *
 * The 15-char cap is enforced at the input as a hard limit, so a valid-length
 * check here is really only about the lower bound — but it is checked on both
 * ends anyway, since the modal can be prefilled programmatically.
 */
export function validateName(raw: string): ValidationResult {
  const value = raw.trim()
  return {
    value,
    valid: value.length >= NAME_MIN_LENGTH && value.length <= NAME_MAX_LENGTH,
  }
}

/**
 * Helper text under the name field (interactions.md §1.1).
 *
 * Two states only — there is deliberately no live "N / 15" counter.
 */
export function nameHelperText(raw: string): string {
  const length = raw.trim().length
  if (length < NAME_MIN_LENGTH) {
    const remaining = NAME_MIN_LENGTH - length
    return `Ще мінімум ${remaining} ${pluralizeSymbols(remaining)}`
  }
  return 'Від 3 до 15 символів'
}

function pluralizeSymbols(n: number): string {
  const forms = { one: 'символ', few: 'символи', many: 'символів' }
  return forms[pluralCategory(n)]
}

/**
 * Guest name on a reservation — docs/stage-2.md §5.4, 1–30 characters trimmed.
 *
 * Separate from `validateName` rather than reusing it: the account name is
 * 3–15 because it is a display identity the owner lives with, while this is a
 * one-off label another guest reads once («Заброньовано: Оксана»). Reusing the
 * account rule would reject a two-letter name for no reason the guest could
 * understand, and tying the two together would mean a future change to one
 * silently moves the other.
 */
export const GUEST_NAME_MIN_LENGTH = 1
export const GUEST_NAME_MAX_LENGTH = 30

export function validateGuestName(raw: string): ValidationResult {
  const value = raw.trim()
  return {
    value,
    valid:
      value.length >= GUEST_NAME_MIN_LENGTH &&
      value.length <= GUEST_NAME_MAX_LENGTH,
  }
}

/** Wish title: trimmed, non-empty, at most 60 characters. */
export function validateTitle(raw: string): ValidationResult {
  const value = raw.trim()
  return { value, valid: value.length > 0 && value.length <= TITLE_MAX_LENGTH }
}

/**
 * Ukrainian plural category by the last digits — docs/spec.md §4.1.
 *
 * Exported because the counter formatter needs it too; kept here so there is a
 * single implementation of the rule in the codebase.
 */
export function pluralCategory(n: number): 'one' | 'few' | 'many' {
  const abs = Math.abs(Math.trunc(n))
  const lastTwo = abs % 100
  const last = abs % 10
  if (lastTwo >= 11 && lastTwo <= 14) return 'many'
  if (last === 1) return 'one'
  if (last >= 2 && last <= 4) return 'few'
  return 'many'
}
