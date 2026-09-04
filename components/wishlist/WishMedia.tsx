'use client'

/**
 * A wish shows either its emoji glyph or its uploaded image — never both
 * (docs/interactions.md §3.3). The emoji is treated as typography, not as an
 * illustration, which is what keeps it inside the "no decorative graphics"
 * rule (docs/spec.md §8).
 */

import { useEffect, useState } from 'react'

import { DEFAULT_EMOJI, type Wish } from '../../lib/domain'

export function WishMedia({ wish }: { wish: Wish }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!wish.image) {
      setImageUrl(null)
      return
    }
    const url = URL.createObjectURL(wish.image)
    setImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [wish.image])

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- object URL from a
      // local Blob; next/image cannot optimize what never leaves the device.
      <img
        src={imageUrl}
        alt=""
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
