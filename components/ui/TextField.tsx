'use client'

/**
 * Input Field from the Ui system: canvas fill at rest, the fill drops out on
 * focus and the global hairline ring takes over (docs/style-guide.md).
 *
 * The ring itself is not declared here — `:focus-visible` in styles/theme.css
 * gives every focusable element the same hairline ring, which is exactly what
 * interactions.md §0.3 asks for.
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
          'block h-10 w-full rounded-control border border-transparent bg-canvas px-3',
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
