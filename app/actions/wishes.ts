'use server'

import { requireUserId } from '../../lib/auth/session'
import { findShareTokenByUserId } from '../../lib/auth/users'
import { destroyImage, uploadImage } from '../../lib/images/cloudinary'
import { buildShareUrl } from '../../lib/share/shareUrl'
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  DEFAULT_EMOJI,
  WISH_LIMIT,
  rejectImage,
  validateName,
  validateTitle,
  type Currency,
  type Profile,
  type Wish,
  type WishPatch,
} from '../../lib/domain'
import { profileRepository, wishRepository } from '../../lib/repositories/server'
import { deleteReservationsForWish } from '../../lib/reservations/store'

/**
 * The app's mutation surface — docs/prompter-task-stage-2.md §1.
 *
 * Every action resolves its own owner through `requireUserId()` and passes it
 * to the repository. None of them accepts a `userId` argument: these are
 * publicly invocable endpoints, so an owner coming from the caller would be an
 * impersonation parameter rather than an identity.
 *
 * The arguments are deliberately narrow. An action taking a general
 * `WishPatch` would let any caller set `createdAt` (reordering someone's list)
 * or `imageUrl`/`imagePublicId` (pointing a card at an arbitrary URL, and
 * orphaning the real Cloudinary file). The UI only ever toggles `isDone`, so
 * that is the only field a client can reach.
 */

export interface NewWishInput {
  title: string
  emoji?: string
  price?: number
  currency?: Currency
  url?: string
}

/** The owner's own public link, for the Share screen (docs/stage-2.md §5.1). */
export async function getShareUrlAction(): Promise<string | null> {
  const userId = await requireUserId()
  const token = await findShareTokenByUserId(userId)
  if (!token) return null

  // `AUTH_URL` is the origin the app is actually served from and is already
  // required by Auth.js; a second variable for the same fact would drift.
  const origin = process.env.AUTH_URL ?? 'http://localhost:3000'
  return buildShareUrl(token, origin)
}

export async function countWishesAction(): Promise<number> {
  const userId = await requireUserId()
  return wishRepository.count(userId)
}

export async function getProfileAction(): Promise<Profile | null> {
  const userId = await requireUserId()
  return profileRepository.get(userId)
}

export async function listWishesAction(): Promise<Wish[]> {
  const userId = await requireUserId()
  return wishRepository.list(userId)
}

/**
 * `image` is the already-compressed blob from the Add form. It arrives as a
 * real `File` — React serializes those across the action boundary — so the
 * bytes never touch Cloudinary directly from the browser, and the API secret
 * never has to leave the server (docs/stage-2.md §7).
 */
export async function createWishAction(
  input: NewWishInput,
  image?: File
): Promise<Wish> {
  const userId = await requireUserId()

  const title = validateTitle(input.title)
  if (!title.valid) throw new Error('Invalid title')

  // The hard lock (docs/stage-2.md §4). The Add screen also disables its own
  // button at 30, but that is convenience — this is the guarantee, and it holds
  // even when the action is called directly. Checked before the Cloudinary
  // upload so a rejected wish never leaves an orphaned file behind.
  // Thrown, not returned: the caller's UI already prevents this, so reaching
  // here means either a direct invocation or a genuine race, and both are
  // failures rather than expected outcomes. The class-free throw is deliberate —
  // a `'use server'` module may only export async functions, and error
  // identity would not survive the action boundary anyway.
  if ((await wishRepository.count(userId)) >= WISH_LIMIT) {
    throw new Error('Wish limit reached')
  }

  const currency =
    input.currency && CURRENCIES.includes(input.currency)
      ? input.currency
      : undefined
  const price =
    typeof input.price === 'number' && Number.isFinite(input.price) && input.price >= 0
      ? input.price
      : undefined

  let uploaded: { imageUrl: string; imagePublicId: string } | undefined
  if (image) {
    // Re-checked here even though ImageUpload already rejected bad files: the
    // client check is a courtesy, this is the boundary.
    if (rejectImage(image)) throw new Error('Rejected image')
    uploaded = await uploadImage(new Uint8Array(await image.arrayBuffer()))
  }

  return wishRepository.create(userId, {
    title: title.value,
    // Emoji and image stay mutually exclusive on the way in, exactly as the
    // form enforces them (interactions.md §3.3).
    ...(uploaded ? uploaded : { emoji: input.emoji }),
    ...(price !== undefined ? { price, currency } : {}),
    ...(input.url ? { url: input.url } : {}),
  })
}

/**
 * What the edit form may change — docs/prompter-task-edit-wish.md §3.3, §4.
 *
 * Notably absent, and absent on purpose:
 * - `isDone` belongs to the ✓ button on the card, not to this form.
 * - `createdAt` is never written: list position is derived from it, so fixing a
 *   typo must not fling the card to the top of the list (§3.4).
 * - `imageUrl` / `imagePublicId` are server-derived from an actual upload. If a
 *   caller could set them, it could point a card at any URL and orphan the real
 *   Cloudinary file — the same reasoning as the note at the top of this file.
 */
export interface EditWishInput {
  title: string
  emoji?: string
  price?: number
  currency?: Currency
  url?: string
  /** True when the user cleared the existing image with «×» (§4). */
  removeImage?: boolean
}

/**
 * Result rather than a bare throw, because "this wish is already gone" is an
 * expected outcome the form must tell apart from a generic failure: it shows
 * «Це бажання вже видалене» and leaves for the list (§6). Error identity does
 * not survive the Server Action boundary, so a thrown subclass could not carry
 * that distinction.
 */
export type UpdateWishResult =
  | { ok: true; wish: Wish }
  | { ok: false; reason: 'not-found' }

export async function updateWishAction(
  id: string,
  input: EditWishInput,
  image?: File
): Promise<UpdateWishResult> {
  const userId = await requireUserId()

  const title = validateTitle(input.title)
  if (!title.valid) throw new Error('Invalid title')

  // No 30-wish check here: editing creates no records (§7).
  //
  // And no reservation cascade here either, deliberately: docs/stage-2.md
  // §5.4's edge-case table says editing a reserved wish's title, price or image
  // leaves the reservation in place. It is the same record with a corrected
  // label, not a different gift, and the guest who claimed it has no way to
  // learn it was renamed. Delete and done are the only two mutations that
  // cascade.

  // Read first, only to learn which file may need destroying afterwards. The
  // write below is still scoped by owner in its own filter, so this read is not
  // load-bearing for security.
  const existing = await wishRepository.find(userId, id)
  if (!existing) return { ok: false, reason: 'not-found' }

  const currency =
    input.currency && CURRENCIES.includes(input.currency)
      ? input.currency
      : undefined
  const price =
    typeof input.price === 'number' && Number.isFinite(input.price) && input.price >= 0
      ? input.price
      : undefined

  let uploaded: { imageUrl: string; imagePublicId: string } | undefined
  if (image) {
    if (rejectImage(image)) throw new Error('Rejected image')
    uploaded = await uploadImage(new Uint8Array(await image.arrayBuffer()))
  }

  const clearing = !uploaded && input.removeImage === true

  // `null` where a field should be cleared, not `undefined` — the latter means
  // "leave as is", so emptying the price box would silently keep the old price.
  const patch: WishPatch = {
    title: title.value,
    price: price ?? null,
    currency: price !== undefined ? (currency ?? DEFAULT_CURRENCY) : null,
    url: input.url || null,
    ...(uploaded
      ? uploaded
      : clearing
        ? {
            // Falls back to the chosen emoji, or the default glyph — a card
            // must never end up with neither image nor emoji (§4).
            imageUrl: null,
            imagePublicId: null,
            emoji: input.emoji || DEFAULT_EMOJI,
          }
        : { emoji: input.emoji || DEFAULT_EMOJI }),
  }

  let updated: Wish
  try {
    updated = await wishRepository.update(userId, id, patch)
  } catch (error) {
    // The write failed. If we had just uploaded a replacement, it is now
    // referenced by nothing — destroy it rather than leave it orphaned. The old
    // file is untouched, so the wish keeps the image it already had.
    if (uploaded) await destroyImage(uploaded.imagePublicId)
    // Deleted from another tab between the read above and this write.
    if (isNotFound(error)) return { ok: false, reason: 'not-found' }
    throw error
  }

  // Only now, after the record is safely written, is the old file expendable.
  // Destroying it first would leave the wish with no image at all if the write
  // then failed (§4).
  const replaced = uploaded || clearing
  if (replaced && existing.imagePublicId) {
    await destroyImage(existing.imagePublicId)
  }

  return { ok: true, wish: updated }
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && error.message.endsWith('not found')
}

export async function setWishDoneAction(
  id: string,
  isDone: boolean
): Promise<Wish> {
  const userId = await requireUserId()
  const wish = await wishRepository.update(userId, id, { isDone })

  // Cascade (docs/stage-2.md §5.4). Only on the way *to* done: a done wish is
  // already absent from the guest screen, so a reservation on it points at a
  // card nobody can see. Un-checking deliberately does not resurrect it — the
  // edge-case table treats the reservation as gone, not suspended, and a guest
  // who has since reserved something else would otherwise end up holding two.
  //
  // After the update, never before, mirroring how the Cloudinary cleanup is
  // sequenced in `removeWishAction`: the owner's own mutation is the thing they
  // asked for, and it must not be held hostage by a dependent cleanup.
  if (isDone) await deleteReservationsForWish(id)

  return wish
}

export async function removeWishAction(id: string): Promise<void> {
  const userId = await requireUserId()
  const removed = await wishRepository.remove(userId, id)

  // The wish is already gone at this point, and `destroyImage` swallows its own
  // failures — so a Cloudinary outage orphans a file but never resurrects a
  // wish the user asked to delete (docs/stage-2.md §7).
  if (removed?.imagePublicId) await destroyImage(removed.imagePublicId)

  // Same cascade, same ordering. Guarded on `removed` so a foreign or
  // already-deleted id cannot be used to strip a reservation off a wish the
  // caller does not own: `remove` returns null in exactly those cases.
  if (removed) await deleteReservationsForWish(id)
}

export async function renameProfileAction(rawName: string): Promise<void> {
  const userId = await requireUserId()

  // Same rule as the modal enforces client-side, applied again here because
  // this is the boundary (interactions.md §2.7).
  const name = validateName(rawName)
  if (!name.valid) throw new Error('Invalid name')

  const profile = await profileRepository.get(userId)
  if (!profile) throw new Error('Profile not found')

  await profileRepository.save({ ...profile, name: name.value })
}
