'use client'

/**
 * Badge from the Ui system — used as the segmented filter control
 * (docs/interactions.md §2.2). Active is Solid, the rest Outline.
 *
 * Soft exists in the design system but is deliberately not used for the active
 * filter: on the canvas page background a Soft badge is the same tone as the
 * page, so the Outline siblings end up reading as the selected one.
 */

import type { ButtonHTMLAttributes } from 'react'

export type BadgeVariant = 'solid' | 'soft' | 'outline'

const VARIANTS: Record<BadgeVariant, string> = {
  solid: 'bg-ink-soft text-surface-alt border-transparent',
  soft: 'bg-canvas text-ink-soft border-transparent',
  outline: 'bg-transparent text-ink border-hairline',
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
    <button
      type={type}
      className={[
        'inline-flex h-8 items-center rounded-control border px-3',
        'text-body font-medium transition-colors duration-150 ease-out',
        VARIANTS[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
}
