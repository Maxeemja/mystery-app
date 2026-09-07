'use server'

import { requireUserId } from '../../lib/auth/session'
import {
  CURRENCIES,
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

export async function getProfileAction(): Promise<Profile | null> {
  const userId = await requireUserId()
  return profileRepository.get(userId)
}

export async function listWishesAction(): Promise<Wish[]> {
  const userId = await requireUserId()
  return wishRepository.list(userId)
}

export async function createWishAction(input: NewWishInput): Promise<Wish> {
  const userId = await requireUserId()

  const title = validateTitle(input.title)
  if (!title.valid) throw new Error('Invalid title')

  const currency =
    input.currency && CURRENCIES.includes(input.currency)
      ? input.currency
      : undefined
  const price =
    typeof input.price === 'number' && Number.isFinite(input.price) && input.price >= 0
      ? input.price
      : undefined

  return wishRepository.create(userId, {
    title: title.value,
    ...(input.emoji ? { emoji: input.emoji } : {}),
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
  await wishRepository.remove(userId, id)
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
