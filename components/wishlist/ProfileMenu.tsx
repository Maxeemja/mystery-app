'use client'

/**
 * Profile menu — docs/stage-2.md §3.3.
 *
 * On stage 1 the name in the hub header opened the rename modal directly. It
 * now opens this menu, which offers «Змінити імʼя» and «Вийти». The rename
 * modal and its validation are untouched; only the entry point moved.
 *
 * Esc closes it, matching every other dismissible surface in the app
 * (interactions.md §0.3).
 */

import { useEffect, useRef } from 'react'

interface ProfileMenuProps {
  name: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onRename: () => void
  onLogout: () => void
}

export function ProfileMenu({
  name,
  open,
  onOpenChange,
  onRename,
  onLogout,
}: ProfileMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onOpenChange(false)
    }
    // A click anywhere outside dismisses, the same way the delete confirmation
    // yields to the next interaction rather than trapping focus.
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        onOpenChange(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open, onOpenChange])

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className="text-heading font-semibold text-ink"
      >
        {name}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-10 mt-2 min-w-44 rounded-card border border-hairline bg-paper p-1 shadow-subtle"
        >
          <MenuItem
            onClick={() => {
              onOpenChange(false)
              onRename()
            }}
          >
            Змінити імʼя
          </MenuItem>
          <MenuItem
            onClick={() => {
              onOpenChange(false)
              onLogout()
            }}
          >
            Вийти
          </MenuItem>
        </div>
      ) : null}
    </div>
  )
}

function MenuItem({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="block w-full rounded-control px-3 py-2 text-left text-body text-ink transition-colors duration-150 ease-out hover:bg-canvas"
    >
      {children}
    </button>
  )
}
