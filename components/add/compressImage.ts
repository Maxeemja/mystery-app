'use client'

/**
 * Client-side downscaling before the image reaches the repository
 * (docs/interactions.md §3.3, docs/tech-stack.md §2).
 *
 * Lives next to the Add screen rather than in lib/domain because it needs a
 * canvas — lib/domain is meant to stay free of browser APIs.
 *
 * WebP is the output format, not JPEG: PNGs with transparency would otherwise
 * come back with a black or white background.
 *
 * Animated GIFs are stored untouched. `createImageBitmap` would hand back only
 * the first frame, and silently turning someone's animation into a still is a
 * worse outcome than keeping a slightly larger blob — the 5MB cap already
 * bounds the damage.
 */

import { IMAGE_MAX_SIDE } from '../../lib/domain'

export async function compressImage(file: File): Promise<Blob> {
  if (file.type === 'image/gif') return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    // Undecodable in this browser — store the original rather than losing it.
    return file
  }

  const longestSide = Math.max(bitmap.width, bitmap.height)
  const scale = Math.min(1, IMAGE_MAX_SIDE / longestSide)
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    return file
  }
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', 0.85)
  })

  // Keep whichever is smaller: re-encoding a small, already-optimized file can
  // easily make it bigger.
  if (!blob) return file
  return blob.size < file.size ? blob : file
}
