'use client'

/**
 * Profile lookup for the routing gate.
 *
 * Profile existence is only knowable in the browser (docs/tech-stack.md §3), so
 * both `/` and `/init` have to resolve it after mount. `status` exists so
 * callers can render a skeleton while the read is in flight instead of briefly
 * showing the wrong screen.
 */

import { useCallback, useEffect, useState } from 'react'

import { LOCAL_USER_ID, type Profile } from '../lib/domain'
import { localProfileRepository } from '../lib/repositories/client'

export type ProfileStatus = 'loading' | 'ready' | 'error'

export function useProfile() {
  const [status, setStatus] = useState<ProfileStatus>('loading')
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    let cancelled = false

    localProfileRepository
      .get(LOCAL_USER_ID)
      .then((found) => {
        if (cancelled) return
        setProfile(found)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        // Storage is unavailable (private browsing, blocked quota). Treated as
        // "no profile we can read" — the caller decides what to show.
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const refresh = useCallback(async () => {
    const found = await localProfileRepository.get(LOCAL_USER_ID)
    setProfile(found)
    return found
  }, [])

  return { status, profile, setProfile, refresh }
}
