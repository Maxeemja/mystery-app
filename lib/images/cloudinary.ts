import 'server-only'

import { v2 as cloudinary } from 'cloudinary'

/**
 * Cloudinary access — docs/stage-2.md §7, docs/prompter-task-stage-2.md §7.1.
 *
 * `cloudinary.config()` with no arguments reads `CLOUDINARY_URL` from the
 * environment itself. That single variable carries cloud name, API key and API
 * secret together, which is why the spec forbids the separate
 * `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` trio: two sources of
 * truth for one credential drift apart.
 *
 * `server-only` is doing real work in this file. If anything in a client
 * component ever imports it, the build fails loudly rather than shipping the
 * API secret into the browser bundle.
 */
cloudinary.config({ secure: true })

/** All wish images live under one folder, so they're easy to find and purge. */
const FOLDER = 'wishlist'

export interface UploadedImage {
  imageUrl: string
  imagePublicId: string
}

/**
 * Uploads a already-compressed image and returns both fields the schema needs.
 *
 * The upload is signed (the SDK signs with the configured secret) rather than
 * using an unsigned preset. An unsigned preset is a public write endpoint —
 * anyone who found the cloud name could fill the account with files.
 */
export async function uploadImage(bytes: Uint8Array): Promise<UploadedImage> {
  const result = await new Promise<{ secure_url: string; public_id: string }>(
    (resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: FOLDER, resource_type: 'image' },
        (error, uploaded) => {
          if (error || !uploaded) {
            reject(error ?? new Error('Cloudinary upload returned no result'))
            return
          }
          resolve(uploaded)
        }
      )
      stream.end(bytes)
    }
  )

  return { imageUrl: result.secure_url, imagePublicId: result.public_id }
}

/**
 * Best-effort file cleanup.
 *
 * Never throws. docs/stage-2.md §7 is explicit that a wish is still deleted
 * even when its file cannot be: the user asked for the wish to go, and holding
 * their data hostage to a housekeeping call would be the wrong trade. The
 * failure is logged so an orphaned file is at least discoverable.
 */
export async function destroyImage(publicId: string): Promise<void> {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      // Destroy alone only removes the stored asset; the CDN keeps serving its
      // cached copy for a while afterwards, so a "deleted" image stays publicly
      // fetchable by anyone who kept the URL. `invalidate` asks Cloudinary to
      // purge the edge caches too. Propagation is not instant, but without this
      // it never happens at all.
      invalidate: true,
    })
    // `destroy` resolves even when it deleted nothing — a wrong public_id comes
    // back as `{result: 'not found'}`, not as a rejection. Treating the promise
    // resolving as success would hide exactly the bug this cleanup exists to
    // prevent, so the outcome is checked explicitly.
    if (result?.result !== 'ok') {
      console.error(
        `[cloudinary] destroy ${publicId} returned "${result?.result}"; file may be orphaned`
      )
    }
  } catch (error) {
    console.error(
      `[cloudinary] failed to destroy ${publicId}; file is now orphaned`,
      error
    )
  }
}
