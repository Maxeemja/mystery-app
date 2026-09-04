'use client'

/**
 * Modal shell — closes on outside click, on «×» and on Esc, all without saving
 * (docs/interactions.md §2.7).
 *
 * Focus is trapped loosely: the first focusable element is focused on open and
 * focus is returned to the trigger on close. A full focus trap would be more
 * machinery than one small name form needs.
 */

import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

export function Modal({ title, onClose, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const returnFocusTo = useRef<Element | null>(null)

  useEffect(() => {
    returnFocusTo.current = document.activeElement

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (returnFocusTo.current instanceof HTMLElement) {
        returnFocusTo.current.focus()
      }
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        // Outside click closes; mousedown rather than click so a drag that
        // started inside the panel and ended outside doesn't close it.
        if (!panelRef.current?.contains(event.target as Node)) onClose()
      }}
    >
      {/* The scrim is a tone, not a color — the palette has no overlay token. */}
      <div className="absolute inset-0 bg-ink opacity-20" aria-hidden="true" />

      <div
        ref={panelRef}
        className="relative w-full max-w-md rounded-card border border-hairline bg-paper p-card shadow-subtle"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-subheading font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрити"
            className="inline-flex h-8 w-8 items-center justify-center rounded-control text-mid-gray transition-colors duration-150 ease-out hover:text-ink"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
