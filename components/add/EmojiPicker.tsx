'use client'

/**
 * Emoji row — docs/interactions.md §3.2.
 *
 * Selection is marked with a hairline border and the canvas fill, never a
 * colored one. Clicking the selected emoji deselects it; if nothing is selected
 * and no image is uploaded, the default 🎁 is written at save time.
 */

import { EMOJI_CHOICES } from '../../lib/domain'

interface EmojiPickerProps {
  value: string | null
  onChange: (emoji: string | null) => void
  /** Dimmed while an image is chosen — the two are mutually exclusive. */
  dimmed: boolean
}

export function EmojiPicker({ value, onChange, dimmed }: EmojiPickerProps) {
  return (
    <div
      className={[
        'flex flex-wrap gap-2 transition-opacity duration-150 ease-out',
        dimmed ? 'opacity-40' : 'opacity-100',
      ].join(' ')}
    >
      {EMOJI_CHOICES.map((emoji) => {
        const selected = value === emoji
        return (
          <button
            key={emoji}
            type="button"
            aria-pressed={selected}
            aria-label={`Емодзі ${emoji}`}
            onClick={() => onChange(selected ? null : emoji)}
            className={[
              'inline-flex h-11 w-11 items-center justify-center rounded-control border',
              'text-body-lg transition-colors duration-150 ease-out',
              selected
                ? 'border-hairline bg-canvas'
                : 'border-transparent bg-transparent',
            ].join(' ')}
          >
            {emoji}
          </button>
        )
      })}
    </div>
  )
}
