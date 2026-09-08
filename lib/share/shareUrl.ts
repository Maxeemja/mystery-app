/**
 * Absolute URL of a public list — docs/stage-2.md §5.1.
 *
 * Built from `AUTH_URL`, which the stack already requires for Auth.js, rather
 * than from a second variable that would inevitably drift from it. It has to be
 * absolute: the point of the link is to be pasted into a messenger, where a
 * relative path means nothing.
 */
export function buildShareUrl(shareToken: string, origin: string): string {
  return `${origin.replace(/\/+$/, '')}/w/${shareToken}`
}
