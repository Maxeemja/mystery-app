'use client'

/**
 * Badge from the Ui system — used as the segmented filter control
 * (docs/interactions.md §2.2). Active is Solid, the rest Outline.
 *
 * Soft exists in the design system but is deliberately not used for the active
 * filter: on the canvas page background a Soft badge is the same tone as the
 * page, so the Outline siblings end up reading as the selected one.
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type BadgeVariant = 'solid' | 'soft' | 'outline'

const VARIANTS: Record<BadgeVariant, string> = {
  solid: 'bg-ink-soft text-surface-alt border-transparent',
  soft: 'bg-canvas text-ink-soft border-transparent',
  outline: 'bg-transparent text-ink border-hairline',
}

function badgeClass(variant: BadgeVariant, className: string): string {
  return [
    'inline-flex h-8 items-center rounded-control border px-3',
    'text-body font-medium transition-colors duration-150 ease-out',
    VARIANTS[variant],
    className,
  ]
    .filter(Boolean)
    .join(' ')
}

interface BadgeProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BadgeVariant
}

export function Badge({
  variant = 'outline',
  className = '',
  type = 'button',
  ...props
}: BadgeProps) {
  return (
    <button type={type} className={badgeClass(variant, className)} {...props} />
  )
}

/**
 * The same badge as a `<span>`, for a label that is not a control.
 *
 * «Заброньовано: Оксана» reads exactly like the filter badges above it but does
 * nothing when clicked. Rendering it as a `<button>` would put it in the tab
 * order and announce it to a screen reader as something actionable — on a card
 * whose whole message is "there is nothing for you to do here". Sharing
 * `badgeClass` keeps it from drifting away from the real badge visually.
 */
export function StaticBadge({
  variant = 'outline',
  className = '',
  children,
}: {
  variant?: BadgeVariant
  className?: string
  children: ReactNode
}) {
  return <span className={badgeClass(variant, className)}>{children}</span>
}
