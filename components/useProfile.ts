'use client'

/**
 * Profile lookup for the hub header.
 *
 * On stage 1 this read IndexedDB, because profile existence was only knowable
 * in the browser. It now goes through a Server Action, so the identity behind
 * it comes from the session cookie rather than from anything the client says.
 *
 * The `status` triple is unchanged, and so is every caller's handling of it: a
 * failed read still lands on `'error'`, which the screens already render an
 * inline message for. What used to mean "storage unavailable" now also covers
 * "the network call failed" — the same UI is correct for both.
 */

import { useCallback, useEffect, useState } from 'react'

import { getProfileAction } from '../app/actions/wishes'
import type { Profile } from '../lib/domain'

export type ProfileStatus = 'loading' | 'ready' | 'error'

export function useProfile() {
  const [status, setStatus] = useState<ProfileStatus>('loading')
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    let cancelled = false

    getProfileAction()
      .then((found) => {
        if (cancelled) return
        setProfile(found)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const refresh = useCallback(async () => {
    const found = await getProfileAction()
    setProfile(found)
    return found
  }, [])

  return { status, profile, setProfile, refresh }
}
