'use client'

/**
 * «Додати» — docs/interactions.md §3, docs/spec.md §3.2.
 *
 * The form itself now lives in `WishForm`, which serves both this screen and
 * `/edit/{id}` (docs/prompter-task-edit-wish.md §3.1). Keeping this wrapper
 * rather than pointing the route straight at `WishForm` leaves the two screens
 * independently addressable, so a future add-only concern has somewhere to go.
 */

import { WishForm } from './WishForm'

export function AddScreen() {
  return <WishForm mode="add" />
}
