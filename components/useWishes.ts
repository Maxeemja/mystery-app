'use client'

/**
 * Wish list state for the hub screen.
 *
 * Every mutation is optimistic: the UI flips first and the write follows
 * (docs/interactions.md §2.4). If the write fails, the optimistic change is
 * rolled back and `saveError` is raised so the screen can show the inline
 * «Не вдалося зберегти» from interactions.md §0.2.
 *
 * Stage 2 moved the writes from IndexedDB to Server Actions. That makes the
 * failure path far more reachable than it was — offline, latency, a rejected
 * action — but the handling is unchanged, because it was already written for
 * "the write might not land".
 */

import { useCallback, useEffect, useState } from 'react'

import {
  listWishesAction,
  removeWishAction,
  setWishDoneAction,
} from '../app/actions/wishes'
import { countDone, type Wish } from '../lib/domain'

export type WishesStatus = 'loading' | 'ready' | 'error'

export function useWishes() {
  const [status, setStatus] = useState<WishesStatus>('loading')
  const [wishes, setWishes] = useState<Wish[]>([])
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    let cancelled = false

    listWishesAction()
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

  /**
   * `previous` is read directly off the `wishes` closure rather than captured
   * as a side effect inside the optimistic `setWishes` updater. The updater
   * form doesn't guarantee it runs before the code right after it — in
   * particular, when this is invoked from a `setTimeout` callback (as
   * `remove` is, from the hub's post-delete-animation timer) rather than
   * directly inside a React event handler, React can defer running the
   * updater until after the write has already failed and the catch block
   * already checked it, losing the rollback race silently. Reading the
   * closure variable has no such race.
   */
  const toggleDone = useCallback(
    async (id: string) => {
      const previous = wishes.find((wish) => wish.id === id)
      if (!previous) return

      setSaveError(false)
      setWishes((current) =>
        current.map((wish) => (wish.id === id ? { ...wish, isDone: !wish.isDone } : wish))
      )
      try {
        await setWishDoneAction(id, !previous.isDone)
      } catch {
        setSaveError(true)
        setWishes((current) => current.map((wish) => (wish.id === id ? previous : wish)))
      }
    },
    [wishes]
  )

  const remove = useCallback(
    async (id: string) => {
      const previous = wishes.find((wish) => wish.id === id)
      if (!previous) return

      setSaveError(false)
      setWishes((current) => current.filter((wish) => wish.id !== id))
      try {
        await removeWishAction(id)
      } catch {
        setSaveError(true)
        setWishes((current) => [...current, previous])
      }
    },
    [wishes]
  )

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
