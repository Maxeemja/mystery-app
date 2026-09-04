'use client'

/**
 * Wish list state for the hub screen.
 *
 * Every mutation is optimistic: the UI flips first and the write follows
 * (docs/interactions.md §2.4). If the write fails, the optimistic change is
 * rolled back and `saveError` is raised so the screen can show the inline
 * «Не вдалося зберегти» from interactions.md §0.2.
 */

import { useCallback, useEffect, useState } from 'react'

import { LOCAL_USER_ID, countDone, type Wish } from '../lib/domain'
import { wishRepository } from '../lib/repositories'

export type WishesStatus = 'loading' | 'ready' | 'error'

export function useWishes() {
  const [status, setStatus] = useState<WishesStatus>('loading')
  const [wishes, setWishes] = useState<Wish[]>([])
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    let cancelled = false

    wishRepository
      .list(LOCAL_USER_ID)
      .then((found) => {
        if (cancelled) return
        setWishes(found)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const toggleDone = useCallback(async (id: string) => {
    setSaveError(false)
    let previous: Wish | undefined
    setWishes((current) =>
      current.map((wish) => {
        if (wish.id !== id) return wish
        previous = wish
        return { ...wish, isDone: !wish.isDone }
      })
    )
    try {
      await wishRepository.update(id, { isDone: !previous?.isDone })
    } catch {
      setSaveError(true)
      if (previous) {
        const restored = previous
        setWishes((current) =>
          current.map((wish) => (wish.id === id ? restored : wish))
        )
      }
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    setSaveError(false)
    let previous: Wish | undefined
    setWishes((current) => {
      previous = current.find((wish) => wish.id === id)
      return current.filter((wish) => wish.id !== id)
    })
    try {
      await wishRepository.remove(id)
    } catch {
      setSaveError(true)
      if (previous) {
        const restored = previous
        setWishes((current) => [...current, restored])
      }
    }
  }, [])

  return {
    status,
    wishes,
    total: wishes.length,
    done: countDone(wishes),
    saveError,
    toggleDone,
    remove,
  }
}
