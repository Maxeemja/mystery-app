'use server'

import { requireUserId } from '../../lib/auth/session'
import { destroyImage, uploadImage } from '../../lib/images/cloudinary'
import {
  CURRENCIES,
  WISH_LIMIT,
  rejectImage,
  validateName,
  validateTitle,
  type Currency,
  type Profile,
  type Wish,
} from '../../lib/domain'
import { profileRepository, wishRepository } from '../../lib/repositories/server'

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

export async function setWishDoneAction(
  id: string,
  isDone: boolean
): Promise<Wish> {
  const userId = await requireUserId()
  return wishRepository.update(userId, id, { isDone })
}

export async function removeWishAction(id: string): Promise<void> {
  const userId = await requireUserId()
  const removed = await wishRepository.remove(userId, id)

  // The wish is already gone at this point, and `destroyImage` swallows its own
  // failures — so a Cloudinary outage orphans a file but never resurrects a
  // wish the user asked to delete (docs/stage-2.md §7).
  if (removed?.imagePublicId) await destroyImage(removed.imagePublicId)
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
