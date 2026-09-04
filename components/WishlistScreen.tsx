'use client'

/**
 * «Мої бажання» — the hub (docs/interactions.md §2).
 *
 * Stage 1 builds only the profile gate and the loading skeleton; the list,
 * filter, counter and card interactions arrive in stage 2.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useProfile } from './useProfile'

export function WishlistScreen() {
  const router = useRouter()
  const { status, profile } = useProfile()

  useEffect(() => {
    if (status === 'ready' && !profile) router.replace('/init')
  }, [status, profile, router])

  // While the IndexedDB read is in flight we must render a skeleton, never the
  // empty-state copy — otherwise a populated list flashes «Поки що жодного
  // бажання» for a frame (docs/tech-stack.md §3).
  if (status !== 'ready' || !profile) {
    return <ListSkeleton />
  }

  return (
    <main className="mx-auto max-w-page px-6 py-10">
      <h1 className="text-heading font-semibold">Мої бажання</h1>
      <p className="mt-1 text-body text-mid-gray">Привіт, {profile.name}</p>
    </main>
  )
}

function ListSkeleton() {
  return (
    <main className="mx-auto max-w-page px-6 py-10" aria-busy="true">
      <div className="h-9 w-56 rounded-control bg-hairline" />
      <div className="mt-3 h-5 w-40 rounded-control bg-hairline" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-44 rounded-card bg-paper shadow-subtle" />
        ))}
      </div>
    </main>
  )
}
