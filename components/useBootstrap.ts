'use client'

/**
 * One-time account bootstrap, driven from the browser — docs/stage-2.md §6.
 *
 * It has to run here, not on the server: the data being migrated lives in
 * IndexedDB, which only exists in the tab.
 *
 * Order matters. IndexedDB is cleared only after the server reports the
 * migration succeeded — clearing first would destroy the user's only copy if
 * the upload then failed. And because the local store is the input, the whole
 * thing is safe to re-run: the server keys on each wish's local id, so a second
 * attempt tops up what is missing rather than duplicating what landed.
 */

import { useEffect, useRef, useState } from 'react'

import {
  bootstrapAccountAction,
  isBootstrappedAction,
  migrateImageAction,
} from '../app/actions/migration'
import { LOCAL_USER_ID, migrationTruncatedText } from '../lib/domain'
import type { LocalWishInput } from '../lib/migration/bootstrapAccount'
import { localWishRepository } from '../lib/repositories/client'

export type BootstrapStatus = 'checking' | 'running' | 'done' | 'error'

export function useBootstrap() {
  const [status, setStatus] = useState<BootstrapStatus>('checking')
  /** «Перенесено 30 з N…» — only when local data exceeded the limit. */
  const [notice, setNotice] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    // Strict Mode mounts effects twice in development; without this guard the
    // migration would run concurrently with itself. The server is idempotent
    // anyway, but two passes would double every Cloudinary upload.
    if (started.current) return
    started.current = true

    /**
     * Deliberately no `cancelled` flag on this effect.
     *
     * The usual pattern — set `cancelled` in the cleanup and skip state updates
     * afterwards — is actively wrong when combined with the run-once ref above.
     * Under Strict Mode the effect mounts, unmounts and remounts: the *first*
     * pass is the one that does the work, and it is also the one whose cleanup
     * fires, so its final `setStatus('done')` would be suppressed. The second
     * pass then returns immediately at the ref guard and never sets anything.
     * The result is a status stuck on 'checking' forever, so the hub never
     * reloads and shows an empty list even though the wishes were created.
     *
     * Setting state after unmount is a no-op in React 18+, so there is nothing
     * to guard against here anyway.
     */
    async function run() {
      try {
        if (await isBootstrappedAction()) {
          setStatus('done')
          return
        }
        setStatus('running')

        const local = await readLocalWishes()
        const result = await bootstrapAccountAction(local)

        // Only now is it safe to drop the local copy.
        if (local.length > 0 && !result.skipped) await clearLocalWishes()

        if (result.droppedFrom) {
          setNotice(migrationTruncatedText(result.droppedFrom))
        }
        setStatus('done')
      } catch {
        // The list still renders; the local data is untouched and the next
        // sign-in retries.
        setStatus('error')
      }
    }

    void run()
  }, [])

  return { status, notice }
}

/**
 * Reads the stage-1 store and uploads any Blob images, so the server receives
 * plain JSON plus ready Cloudinary URLs.
 *
 * A wish whose image fails to upload is still migrated, without the image —
 * losing the whole wish over one failed picture would be the worse trade, and
 * the title and price are the part the user actually wrote.
 */
async function readLocalWishes(): Promise<LocalWishInput[]> {
  let stored
  try {
    stored = await localWishRepository.list(LOCAL_USER_ID)
  } catch {
    // No IndexedDB at all (private browsing, blocked quota) — nothing to
    // migrate, which is a legitimate "no local data" answer.
    return []
  }

  const migrated: LocalWishInput[] = []
  for (const wish of stored) {
    let uploaded: { imageUrl: string; imagePublicId: string } | undefined
    if (wish.image) {
      try {
        const file = new File([wish.image], 'wish', { type: wish.image.type })
        uploaded = await migrateImageAction(file)
      } catch {
        uploaded = undefined
      }
    }

    migrated.push({
      localId: wish.id,
      title: wish.title,
      isDone: wish.isDone,
      createdAt: wish.createdAt,
      ...(wish.emoji ? { emoji: wish.emoji } : {}),
      ...(wish.price !== undefined ? { price: wish.price } : {}),
      ...(wish.currency ? { currency: wish.currency } : {}),
      ...(wish.url ? { url: wish.url } : {}),
      ...(uploaded ?? {}),
    })
  }
  return migrated
}

async function clearLocalWishes(): Promise<void> {
  try {
    const stored = await localWishRepository.list(LOCAL_USER_ID)
    for (const wish of stored) {
      await localWishRepository.remove(LOCAL_USER_ID, wish.id)
    }
  } catch {
    // Migration already succeeded; a stale local copy is untidy, not harmful —
    // `bootstrappedAt` stops it being migrated again.
  }
}
