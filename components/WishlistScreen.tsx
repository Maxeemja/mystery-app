'use client'

/**
 * «Мої бажання» — the hub (docs/interactions.md §2).
 *
 * The only navigation hub in the app: Add and Share are reachable from here and
 * nowhere else.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Badge } from './ui/Badge'
import { ButtonLink } from './ui/Button'
import { EmptyState } from './wishlist/EmptyState'
import { NameModal } from './wishlist/NameModal'
import { WishCard } from './wishlist/WishCard'
import { useFlipReflow } from './wishlist/useFlipReflow'
import { useProfile } from './useProfile'
import { useWishes } from './useWishes'
import {
  applyFilter,
  formatCounter,
  sortWishes,
  type WishFilter,
} from '../lib/domain'
import { localProfileRepository } from '../lib/repositories/client'

/**
 * Set by the Add screen just before it navigates back, read and cleared here.
 * sessionStorage rather than a query param so a reload doesn't re-trigger the
 * highlight, and rather than app state because the two screens are separate
 * route trees.
 */
export const HIGHLIGHT_KEY = 'wishlist:highlight'

const FILTERS: { id: WishFilter; label: string }[] = [
  { id: 'all', label: 'Усі' },
  { id: 'active', label: 'Активні' },
  { id: 'done', label: 'Здійснені' },
]

/** Matches the 200ms fade+collapse in interactions.md §2.5.4. */
const REMOVE_ANIMATION_MS = 200

export function WishlistScreen() {
  const router = useRouter()
  const { status: profileStatus, profile, setProfile } = useProfile()
  const { status, wishes, total, done, saveError, toggleDone, remove } = useWishes()

  // Filter is never persisted: entering the screen or reloading resets it to
  // «Усі» (interactions.md §2.2). Plain state gives exactly that for free.
  const [filter, setFilter] = useState<WishFilter>('all')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  useEffect(() => {
    if (profileStatus === 'ready' && !profile) router.replace('/init')
  }, [profileStatus, profile, router])

  // Esc closes whichever inline confirmation is open (interactions.md §0.3).
  useEffect(() => {
    if (!confirmingId) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setConfirmingId(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [confirmingId])

  const visible = applyFilter(sortWishes(wishes), filter)

  // Reflow key: order plus filter, so the FLIP pass runs exactly when the grid
  // can have moved.
  const registerCard = useFlipReflow(
    `${filter}:${visible.map((wish) => wish.id).join(',')}`
  )

  // ---- highlight the card that was just added (interactions.md §2.8) ----
  const highlightHandled = useRef(false)
  useEffect(() => {
    if (status !== 'ready' || highlightHandled.current) return
    highlightHandled.current = true

    const id = sessionStorage.getItem(HIGHLIGHT_KEY)
    if (!id) return
    sessionStorage.removeItem(HIGHLIGHT_KEY)
    if (!wishes.some((wish) => wish.id === id)) return

    setHighlightId(id)
    // The animation token runs for 900ms; drop the class afterwards so a later
    // re-render doesn't replay it.
    const timer = setTimeout(() => setHighlightId(null), 900)
    return () => clearTimeout(timer)
  }, [status, wishes])

  const scrollHighlightIntoView = useCallback((element: HTMLElement | null) => {
    if (!element) return
    const box = element.getBoundingClientRect()
    const offscreen = box.top < 0 || box.bottom > window.innerHeight
    if (offscreen) element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  function requestDelete(id: string) {
    // Opening a confirmation closes any other one — only ever one at a time
    // (interactions.md §2.5.3).
    setConfirmingId(id)
  }

  function confirmDelete(id: string) {
    setConfirmingId(null)
    setRemovingId(id)
    setTimeout(() => {
      setRemovingId(null)
      void remove(id)
    }, REMOVE_ANIMATION_MS)
  }

  async function saveName(name: string) {
    if (!profile) return
    const next = { ...profile, name }
    await localProfileRepository.save(next)
    setProfile(next)
  }

  // Sequential early returns (rather than one combined boolean) so that
  // narrowing `profile` to non-null actually holds for the JSX below.
  if (profileStatus === 'loading') {
    return <ListSkeleton />
  }

  // The profile read itself failed (as opposed to a later write, which is
  // handled inline per-action below) — total storage unavailability at boot,
  // not covered by the effect above since it only redirects on a *confirmed*
  // missing profile. Say so rather than rendering a blank screen forever,
  // which would be indistinguishable from a broken deploy.
  if (profileStatus === 'error') {
    return (
      <main className="mx-auto max-w-page px-6 py-10">
        <p className="text-body text-ember">Не вдалося прочитати збережені дані</p>
      </main>
    )
  }

  // Profile confirmed absent: the effect above is about to redirect to /init.
  // Render blank rather than the list skeleton — a skeleton implies "your list
  // is coming", which is misleading a moment before leaving this route
  // entirely (mirrors how InitScreen blanks out for the opposite case).
  if (!profile) {
    return <main className="min-h-screen" />
  }

  // Skeleton while the wish read is in flight — never the empty-state copy, or
  // a populated list flashes «Поки що жодного бажання» (tech-stack.md §3).
  if (status === 'loading') {
    return <ListSkeleton />
  }

  const showFilter = total > 0
  const isEmpty = visible.length === 0

  return (
    <>
      <main className="mx-auto max-w-page px-6 pt-10 pb-28 md:pb-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="text-heading font-semibold text-ink"
            >
              {profile.name}
            </button>
            {/* Always the whole list, never the filtered subset. */}
            <p className="mt-1 text-body text-mid-gray">
              {formatCounter(total, done)}
            </p>
          </div>

          {/* Desktop actions; on mobile they live in the pinned bar below. */}
          <div className="hidden shrink-0 gap-2 md:flex">
            <ButtonLink href="/share" variant="outline">
              Поділитися
            </ButtonLink>
            <ButtonLink href="/add">Додати</ButtonLink>
          </div>
        </header>

        {showFilter ? (
          <div className="mt-6 flex gap-2">
            {FILTERS.map(({ id, label }) => (
              <Badge
                key={id}
                variant={filter === id ? 'solid' : 'outline'}
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
              >
                {label}
              </Badge>
            ))}
          </div>
        ) : null}

        {saveError ? (
          <p className="mt-4 text-body text-ember">Не вдалося зберегти</p>
        ) : null}

        {status === 'error' ? (
          <p className="mt-4 text-body text-ember">
            Не вдалося прочитати збережені бажання
          </p>
        ) : null}

        {isEmpty ? (
          <EmptyState total={total} filter={filter} />
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((wish) => (
              <WishCard
                key={wish.id}
                wish={wish}
                confirmingDelete={confirmingId === wish.id}
                removing={removingId === wish.id}
                highlighted={highlightId === wish.id}
                ref={(element) => {
                  registerCard(wish.id, element)
                  if (highlightId === wish.id) scrollHighlightIntoView(element)
                }}
                onToggleDone={() => void toggleDone(wish.id)}
                onRequestDelete={() => requestDelete(wish.id)}
                onCancelDelete={() => setConfirmingId(null)}
                onConfirmDelete={() => confirmDelete(wish.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Mobile: «Додати» pinned to the bottom of the screen (spec.md §4). */}
      <nav className="fixed inset-x-0 bottom-0 flex gap-2 border-t border-hairline bg-canvas px-6 py-4 md:hidden">
        <ButtonLink href="/share" variant="outline" fullWidth className="flex-1">
          Поділитися
        </ButtonLink>
        <ButtonLink href="/add" fullWidth className="flex-1">
          Додати
        </ButtonLink>
      </nav>

      {editingName ? (
        <NameModal
          currentName={profile.name}
          onClose={() => setEditingName(false)}
          onSave={saveName}
        />
      ) : null}
    </>
  )
}

function ListSkeleton() {
  return (
    <main className="mx-auto max-w-page px-6 py-10" aria-busy="true">
      <div className="h-9 w-56 rounded-control bg-hairline" />
      <div className="mt-3 h-5 w-40 rounded-control bg-hairline" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-44 rounded-card bg-paper shadow-subtle" />
        ))}
      </div>
    </main>
  )
}
