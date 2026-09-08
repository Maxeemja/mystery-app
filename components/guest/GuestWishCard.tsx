/**
 * Read-only card for `/w/{token}` — docs/stage-2.md §5.3.
 *
 * A Server Component with no interactivity at all, which is what lets the guest
 * screen work with JavaScript disabled. No «✓», no delete, no hover controls.
 *
 * The «Подивитися →» link is a deliberate departure from the owner's own Share
 * screen, which shows emoji, title and price only (spec.md §3.3). A guest is
 * looking at the list in order to buy something, and without the URL they have
 * to go and find the product themselves.
 */

import { DEFAULT_EMOJI, formatPrice, type Wish } from '../../lib/domain'

export function GuestWishCard({ wish }: { wish: Wish }) {
  const price = formatPrice(wish.price, wish.currency)

  return (
    <div className="flex flex-col rounded-card border border-hairline bg-paper p-card shadow-subtle">
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
    </div>
  )
}
