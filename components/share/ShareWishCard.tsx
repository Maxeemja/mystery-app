/**
 * Simplified, non-interactive card for the Share screen — docs/interactions.md
 * §4.1: emoji/image, name, price only. No «Подивитися», no «✓», no delete.
 *
 * A plain `<div>`, not the hub's `<WishCard>` — reusing that component would
 * drag in hover-reveal controls and delete-confirmation state that have no
 * business existing on a read-only screen.
 */

import { WishMedia } from '../wishlist/WishMedia'
import { formatPrice, type Wish } from '../../lib/domain'

export function ShareWishCard({ wish }: { wish: Wish }) {
  const price = formatPrice(wish.price, wish.currency)

  return (
    <div className="rounded-card border border-hairline bg-paper p-card shadow-subtle">
      <WishMedia wish={wish} />
      <h3 className="mt-2 text-body-lg font-medium text-ink">{wish.title}</h3>
      {price ? <p className="text-body text-mid-gray">{price}</p> : null}
    </div>
  )
}
