'use client'

/**
 * A wish shows either its emoji glyph or its uploaded image — never both
 * (docs/interactions.md §3.3). The emoji is treated as typography, not as an
 * illustration, which is what keeps it inside the "no decorative graphics"
 * rule (docs/spec.md §8).
 *
 * ## Why `crossOrigin="anonymous"` is load-bearing
 *
 * «Зберегти як картинку» rasterizes these cards through a canvas
 * (lib/share/captureNode.ts). On stage 1 the images were same-origin Blob URLs,
 * so that always worked. Cloudinary URLs are cross-origin, and drawing a
 * cross-origin image onto a canvas *taints* it — every later read of that
 * canvas throws a SecurityError, so the PNG export would fail or come back
 * blank. Requesting the image in CORS mode instead, against Cloudinary's
 * `Access-Control-Allow-Origin: *` on delivery URLs, keeps the canvas clean.
 *
 * This is also why these stay plain `<img>` rather than `next/image`: the
 * capture library needs one predictable element with a known `src`, not a
 * srcset the browser may resolve differently between render and capture.
 * Nothing here needs `images.remotePatterns` as a result.
 */

import { useEffect, useState } from 'react'

import { DEFAULT_EMOJI, type Wish } from '../../lib/domain'

export function WishMedia({ wish }: { wish: Wish }) {
  // Legacy local blobs (stage-1 records that stage 3 will migrate) still need
  // an object URL; account-backed wishes carry a ready Cloudinary URL.
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!wish.image) {
      setBlobUrl(null)
      return
    }
    const url = URL.createObjectURL(wish.image)
    setBlobUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [wish.image])

  const src = wish.imageUrl ?? blobUrl

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- see the note above
      <img
        src={src}
        alt=""
        // Only meaningful for the remote case; harmless on an object URL.
        crossOrigin={wish.imageUrl ? 'anonymous' : undefined}
        className="h-16 w-16 rounded-media object-cover"
      />
    )
  }

  return (
    <span className="block text-heading-lg leading-none" aria-hidden="true">
      {wish.emoji ?? DEFAULT_EMOJI}
    </span>
  )
}
