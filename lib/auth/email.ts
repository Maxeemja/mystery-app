/**
 * Email normalization and shape check.
 *
 * No `server-only` guard here on purpose: `/register` needs the same predicate
 * client-side to decide when «Створити акаунт» becomes enabled, and a second
 * copy of the rule would drift from this one.
 */

/**
 * Trim + lowercase. Applied before *both* the uniqueness lookup and the write —
 * doing it on only one of them lets `A@x.com` and `a@x.com` become two accounts
 * that each believe they own the address.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * Deliberately loose: one `@`, something either side, a dot in the domain, no
 * spaces. Tighter regexes reject addresses that are actually valid (plus tags,
 * new TLDs, unicode domains), and the only real proof an address exists is
 * sending mail to it — which this stack cannot do (docs/stage-2.md §3.4).
 */
export function looksLikeEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(raw))
}
