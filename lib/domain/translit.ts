/**
 * Ukrainian → Latin transliteration for the share PNG filename.
 * docs/interactions.md §4.3: «Мар'яна» must produce `wishlist-maryana.png`.
 *
 * Note this is NOT the KMU-2010 official table, which renders я as `ia` and
 * would give `mariana`. The documented expected output is `maryana`, so the
 * common `я → ya` variant is used throughout.
 */

const MAP: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'h',
  ґ: 'g',
  д: 'd',
  е: 'e',
  є: 'ye',
  ж: 'zh',
  з: 'z',
  и: 'y',
  і: 'i',
  ї: 'yi',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ю: 'yu',
  я: 'ya',
  ь: '',
  // Apostrophes are dropped, in all the shapes a Ukrainian keyboard produces.
  "'": '',
  '’': '',
  'ʼ': '',
  '`': '',
}

/** «Мар'яна» → `maryana` */
export function transliterate(input: string): string {
  let out = ''
  for (const char of input.toLowerCase()) {
    out += char in MAP ? MAP[char] : char
  }
  return out
}

/**
 * Transliterate, then reduce to a safe filename fragment:
 * lowercase, only `a–z 0–9 -`, no leading/trailing or repeated dashes.
 */
export function slugify(input: string): string {
  return transliterate(input)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** «Мар'яна» → `wishlist-maryana.png` */
export function shareImageFilename(name: string): string {
  const slug = slugify(name)
  return slug ? `wishlist-${slug}.png` : 'wishlist.png'
}
