'use client'

/**
 * Input Field from the Ui system: canvas fill at rest, the fill drops out on
 * focus and the global hairline ring takes over (docs/style-guide.md).
 *
 * The ring itself is not declared here — `:focus-visible` in styles/theme.css
 * gives every focusable element the same hairline ring, which is exactly what
 * interactions.md §0.3 asks for.
 *
 * ## Why there is a resting border
 *
 * `--color-canvas` is both the page background and the input's resting fill.
 * Inside a card (`bg-paper`) the soft gray fill differentiates the field from
 * the surface beneath it, which is what the style guide describes. On a screen
 * where the field sits directly on the page — `/login`, `/register` — it is
 * #f5f5f5 on #f5f5f5 with a transparent border, so the control has no visible
 * shape at all until focus inverts it.
 *
 * The fix is a resting hairline border on the primitive rather than wrapping
 * those screens in a card. A control should define its own shape regardless of
 * what it is placed on; fixing it here also covers every future screen that
 * puts a field on the canvas, instead of patching the two that expose the
 * problem today. `--color-hairline` is an existing token — no new color.
 */

import type { InputHTMLAttributes, ReactNode, Ref } from 'react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  /** Rendered under the field in Mid Gray, or Ember when `tone` is 'error'. */
  helper?: ReactNode
  tone?: 'muted' | 'error'
  /** React 19 passes refs to function components as a plain prop. */
  ref?: Ref<HTMLInputElement>
}

export function TextField({
  label,
  helper,
  tone = 'muted',
  id,
  className = '',
  ref,
  ...props
}: TextFieldProps) {
  return (
    <div>
      {label ? (
        <label htmlFor={id} className="mb-2 block text-body font-medium text-ink">
          {label}
        </label>
      ) : null}

      <input
        id={id}
        ref={ref}
        className={[
          'block h-10 w-full rounded-control border border-hairline bg-canvas px-3',
          'text-body text-ink placeholder:text-mid-gray',
          'transition-colors duration-150 ease-out focus:bg-paper',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />

      {helper ? (
        <p
          className={[
            'mt-2 text-body',
            tone === 'error' ? 'text-ember' : 'text-mid-gray',
          ].join(' ')}
        >
          {helper}
        </p>
      ) : null}
    </div>
  )
}
