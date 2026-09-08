'use client'

/**
 * Select styled to match the Input Field — same fill, same radius, same height,
 * so the price amount and its currency read as one control
 * (docs/interactions.md §3.4).
 *
 * The chevron is an inline SVG data URI in Mid Gray rather than the native
 * arrow, which varies per platform and would be the one piece of unthemed
 * chrome on the screen.
 */

import type { SelectHTMLAttributes } from 'react'

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")"

export function Select({
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={[
        // Resting hairline for the same reason as TextField — see the note
        // there; the two controls have to agree or the price row looks broken.
        'h-10 appearance-none rounded-control border border-hairline bg-canvas',
        'py-2 pr-8 pl-3 text-body text-ink',
        'transition-colors duration-150 ease-out focus:bg-paper',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        backgroundImage: CHEVRON,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
      }}
      {...props}
    />
  )
}
