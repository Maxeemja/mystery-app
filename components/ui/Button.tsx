'use client'

/**
 * The four button variants of the Ui system (docs/style-guide.md §Components).
 *
 * No shadow on any of them — `shadow-*` doesn't exist outside `shadow-subtle`
 * anyway, but the omission is intentional, not accidental.
 *
 * `destructive` is text-only Ember on a hairline outline rather than a filled
 * red block: the style guide reserves the color for the mark itself, and a
 * solid Ember fill would be the largest color area in an otherwise achromatic
 * app.
 */

import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'destructive'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-surface-alt',
  ghost: 'bg-canvas text-ink',
  outline: 'border border-hairline bg-transparent text-ink',
  destructive: 'border border-hairline bg-transparent text-ember',
}

/** Muted tone, never Ember — disabled is not an error (interactions.md §1.2). */
const DISABLED = 'bg-canvas text-mid-gray cursor-not-allowed'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  fullWidth = false,
  className = '',
  disabled = false,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={[
        'inline-flex h-10 items-center justify-center gap-2 rounded-control px-4',
        'text-body font-medium whitespace-nowrap transition-colors duration-150 ease-out',
        disabled ? DISABLED : VARIANTS[variant],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
}
