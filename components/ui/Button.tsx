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

import Link from 'next/link'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'destructive'

/**
 * Each variant declares its own border color. Putting `border-transparent` in
 * the shared base instead would silently win over the variant's
 * `border-hairline`: both are border-color utilities with equal specificity, so
 * the winner is decided by order in the generated stylesheet, not by order in
 * the class attribute.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-ink text-surface-alt',
  // Hairline rather than transparent: `bg-canvas` is also the page background,
  // so on a screen without a card beneath it a transparent-bordered ghost
  // button has no visible edge at all. Same reasoning as TextField.
  ghost: 'border-hairline bg-canvas text-ink',
  outline: 'border-hairline bg-transparent text-ink',
  destructive: 'border-hairline bg-transparent text-ember',
}

/**
 * Muted tone, never Ember — disabled is not an error (interactions.md §1.2).
 * Bordered for the same reason as `ghost`: the disabled «Створити акаунт» on
 * `/register` sits straight on the canvas, and unbordered it read as absent
 * rather than as unavailable.
 */
const DISABLED = 'border-hairline bg-canvas text-mid-gray cursor-not-allowed'

const BASE =
  'inline-flex h-10 items-center justify-center gap-2 rounded-control border px-4 text-body font-medium whitespace-nowrap transition-colors duration-150 ease-out'

function buttonClass(
  variant: ButtonVariant,
  disabled: boolean,
  fullWidth: boolean,
  className: string
) {
  return [
    BASE,
    disabled ? DISABLED : VARIANTS[variant],
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
}

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
      className={buttonClass(variant, disabled, fullWidth, className)}
      {...props}
    />
  )
}

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  variant?: ButtonVariant
  fullWidth?: boolean
}

/**
 * Navigation that looks like a button. Separate from `Button` because a
 * `<button>` nested inside an `<a>` is invalid markup and breaks keyboard
 * semantics — the control has to actually be the link.
 */
export function ButtonLink({
  href,
  variant = 'primary',
  fullWidth = false,
  className = '',
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={buttonClass(variant, false, fullWidth, className)}
      {...props}
    />
  )
}
