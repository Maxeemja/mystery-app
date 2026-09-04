/**
 * Image constraints — docs/interactions.md §3.3, docs/spec.md §2.
 *
 * Pure checks only: size and MIME type are read off the File object, so this
 * runs before the file is ever read into memory. The actual downscaling needs
 * a canvas and therefore lives with the screen that uses it.
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB

export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

/** Longer side after client-side downscaling. */
export const IMAGE_MAX_SIDE = 1200

export type ImageRejection = 'too-large' | 'unsupported-format'

export const IMAGE_ERROR_TEXT: Record<ImageRejection, string> = {
  'too-large': 'Файл завеликий, максимум 5 МБ',
  'unsupported-format': 'Непідтримуваний формат',
}

/**
 * Format is checked before size: telling someone their .bmp is too large would
 * send them off to shrink a file that was never going to be accepted.
 */
export function rejectImage(file: {
  size: number
  type: string
}): ImageRejection | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as never)) {
    return 'unsupported-format'
  }
  if (file.size > MAX_IMAGE_BYTES) return 'too-large'
  return null
}
