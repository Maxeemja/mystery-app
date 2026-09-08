'use server'

import { requireUserId } from '../../lib/auth/session'
import { uploadImage } from '../../lib/images/cloudinary'
import { rejectImage } from '../../lib/domain'
import {
  bootstrapAccount,
  isBootstrapped,
  type BootstrapResult,
  type LocalWishInput,
} from '../../lib/migration/bootstrapAccount'

/**
 * Migration entry points — docs/stage-2.md §6.
 *
 * Split in two because images can't ride along with the rest. A local wish's
 * image is a Blob in the browser; it has to reach Cloudinary before the wish
 * document can reference it, and Server Action arguments are serialized once,
 * so one call carrying every blob would be a single huge payload that fails as
 * a unit. Uploading per image lets a partial failure leave the rest migratable
 * on the next attempt.
 */

export async function isBootstrappedAction(): Promise<boolean> {
  const userId = await requireUserId()
  return isBootstrapped(userId)
}

/** Uploads one migrated image and hands back what the wish doc needs. */
export async function migrateImageAction(
  image: File
): Promise<{ imageUrl: string; imagePublicId: string }> {
  await requireUserId()
  if (rejectImage(image)) throw new Error('Rejected image')
  return uploadImage(new Uint8Array(await image.arrayBuffer()))
}

export async function bootstrapAccountAction(
  local: LocalWishInput[]
): Promise<BootstrapResult> {
  const userId = await requireUserId()
  return bootstrapAccount(userId, local)
}
