/**
 * URL handling — docs/interactions.md §3.5.
 *
 * Validation is deliberately soft: the field is optional and not worth any
 * friction. A string that doesn't look like a link produces a hint, never a
 * blocked save.
 */

/**
 * `rozetka.com.ua` → `https://rozetka.com.ua`
 *
 * An existing http/https protocol is left alone. Returns `undefined` for an
 * empty input so the field is simply omitted from the record.
 */
export function normalizeUrl(raw: string): string | undefined {
  const value = raw.trim()
  if (value === '') return undefined
  if (/^https?:\/\//i.test(value)) return value
  return `https://${value}`
}

/**
 * Soft "does this look like a link?" check.
 *
 * Deliberately permissive — it only has to catch input that is obviously prose
 * rather than a URL. Anything with a dotted host (or an explicit protocol) that
 * the platform URL parser accepts passes.
 */
export function looksLikeUrl(raw: string): boolean {
  const value = raw.trim()
  if (value === '') return true // empty is fine — the field is optional
  if (/\s/.test(value)) return false

  const candidate = normalizeUrl(value)
  if (!candidate) return false

  try {
    const { hostname } = new URL(candidate)
    // Require a dotted host with a plausible TLD: "foo" is not a link,
    // "foo.com" and "sub.foo.com.ua" are.
    return /^[^.]+(\.[^.]+)*\.[a-z]{2,}$/i.test(hostname)
  } catch {
    return false
  }
}
