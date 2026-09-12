/**
 * The body of a `/w/{token}` card — docs/stage-2.md §5.3.
 *
 * Extracted from `GuestWishCard` so the reservable variant can reuse it without
 * copying the markup. A React component adds no DOM node, so the owner's card
 * renders byte-for-byte what it rendered before the reservation feature
 * existed — which is the point: §5.4 requires the owner's own view of their
 * link to be unchanged, not merely "the same minus a hidden element".
 *
 * No hooks and no `'use client'`, so it works on both sides of the boundary:
 * the owner's branch renders it on the server, the guest's branch renders it
 * inside a Client Component.
 */

import { DEFAULT_EMOJI, formatPrice, type Wish } from '../../lib/domain'

/** Shared so the two card shells cannot drift apart. */
export const GUEST_CARD_CLASS =
  'flex flex-col rounded-card border border-hairline bg-paper p-card shadow-subtle'

export function GuestWishContent({ wish }: { wish: Wish }) {
  const price = formatPrice(wish.price, wish.currency)

  return (
    <>
      {/* Media is rendered here rather than through the hub's `WishMedia`,
          which is a Client Component: it exists to turn a local Blob into an
          object URL, and an account-backed wish never has one. Reusing it
          would ship JavaScript to a screen whose whole point is not needing
          any. */}
      {wish.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- plain <img> keeps
        // this subtree free of client JS; see the note above.
        <img
          src={wish.imageUrl}
          alt=""
          className="h-16 w-16 rounded-media object-cover"
        />
      ) : (
        <span className="block text-heading-lg leading-none" aria-hidden="true">
          {wish.emoji ?? DEFAULT_EMOJI}
        </span>
      )}
      <h3 className="mt-2 text-body-lg font-medium text-ink">{wish.title}</h3>
      {price ? <p className="text-body text-mid-gray">{price}</p> : null}

      {wish.url ? (
        <a
          href={wish.url}
          target="_blank"
          // noopener stops the opened tab reaching back through window.opener;
          // these are URLs the owner pasted in, so they are not trusted markup.
          rel="noopener noreferrer"
          className="mt-3 text-body font-medium text-ink underline"
        >
          Подивитися →
        </a>
      ) : null}
    </>
  )
}
