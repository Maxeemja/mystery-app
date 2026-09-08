import { WishForm } from '../../../components/WishForm'
import { requireOwnedWish } from '../../../lib/wishes/requireOwnedWish'

/**
 * «Редагувати бажання» — docs/prompter-task-edit-wish.md §3.
 *
 * The wish is resolved on the server so the form opens already filled, rather
 * than rendering empty and populating after a client fetch. `requireOwnedWish`
 * answers a foreign id and a nonexistent one identically with a 404 (§6);
 * `middleware.ts` handles the unauthenticated case before this runs.
 */
export default async function EditWishPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const wish = await requireOwnedWish(id)

  return <WishForm mode="edit" wish={wish} />
}
