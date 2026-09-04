'use client'

/**
 * FLIP reflow for the card grid — docs/interactions.md §2.4 step 3.
 *
 * When a wish is checked it moves to the end of the list. The requirement is a
 * smooth 300ms reflow rather than a jump, which CSS alone cannot express for
 * grid reordering: the browser relayouts instantly. So positions are measured
 * before and after the render, the delta is applied as a transform, and the
 * transform is then animated back to zero.
 *
 * Reduced motion needs no special case here — the global
 * `prefers-reduced-motion` block in styles/theme.css collapses the inline
 * transition duration, so the cards land in their end positions immediately.
 */

import { useCallback, useLayoutEffect, useRef } from 'react'

export function useFlipReflow(key: string) {
  const nodes = useRef(new Map<string, HTMLElement>())
  const positions = useRef(new Map<string, DOMRect>())

  const register = useCallback((id: string, element: HTMLElement | null) => {
    if (element) nodes.current.set(id, element)
    else nodes.current.delete(id)
  }, [])

  useLayoutEffect(() => {
    for (const [id, element] of nodes.current) {
      const before = positions.current.get(id)
      if (!before) continue

      const after = element.getBoundingClientRect()
      const dx = before.left - after.left
      const dy = before.top - after.top
      if (dx === 0 && dy === 0) continue

      element.style.transition = 'none'
      element.style.transform = `translate(${dx}px, ${dy}px)`
      requestAnimationFrame(() => {
        element.style.transition = 'transform 300ms ease-out'
        element.style.transform = ''
      })
    }

    const next = new Map<string, DOMRect>()
    for (const [id, element] of nodes.current) {
      next.set(id, element.getBoundingClientRect())
    }
    positions.current = next
  }, [key])

  return register
}
