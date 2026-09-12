'use client'

/**
 * A `/w/{token}` card a guest can claim — docs/stage-2.md §5.4.
 *
 * The card body is the same `GuestWishContent` the owner's read-only card
 * renders; everything added here sits below it or fades in over it.
 *
 * The name prompt uses the inline-confirmation pattern from the owner's own
 * `WishCard` (interactions.md §2.5), which §5.4 names explicitly: two faces on
 * one card, cross-faded over 150ms, no modal and no resize. A `min-h` on the
 * shell guarantees the form's face always has room, so opening it can never
 * make the card grow and shove the grid around.
 *
 * Which card is prompting is owned by the grid, not by each card, so opening
 * one closes any other — the same "only ever one at a time" rule the delete
 * confirmation follows (interactions.md §2.5.3).
 */

import { useEffect, useRef, useState } from 'react'

import { GUEST_CARD_CLASS, GuestWishContent } from './GuestWishContent'
import { StaticBadge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import {
  GUEST_NAME_MAX_LENGTH,
  validateGuestName,
  type Wish,
} from '../../lib/domain'
import type { WishReservation } from '../../lib/share/guestReservations'
import type { ReserveResult } from '../../app/actions/reservations'

interface ReservableWishCardProps {
  wish: Wish
  /** Null when nobody holds this wish. */
  reservation: WishReservation | null
  /** True when this guest's one reservation is somewhere on this list. */
  holdsReservation: boolean
  /** Whether this card is the one showing the name prompt. */
  naming: boolean
  onOpenPrompt: () => void
  onClosePrompt: () => void
  onReserve: (guestName: string) => Promise<ReserveResult>
  onCancel: () => Promise<void>
}

const RACE_MESSAGE = 'Хтось інший щойно забронював це'
const LIMIT_MESSAGE = 'У тебе вже є бронь у цьому списку'
const FAILURE_MESSAGE = 'Не вдалося забронювати'

export function ReservableWishCard({
  wish,
  reservation,
  holdsReservation,
  naming,
  onOpenPrompt,
  onClosePrompt,
  onReserve,
  onCancel,
}: ReservableWishCardProps) {
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Autofocus on open — the field is always empty here, so unlike `NameModal`
  // there is no caret placement to get right.
  useEffect(() => {
    if (naming) inputRef.current?.focus()
    else setName('')
  }, [naming])

  const canConfirm = validateGuestName(name).valid && !pending

  function close() {
    onClosePrompt()
  }

  async function confirm() {
    if (!canConfirm) return
    setPending(true)
    const result = await onReserve(validateGuestName(name).value)
    setPending(false)
    close()

    // On both race outcomes the grid has already resynced itself from the
    // server, so this card only has to say what happened. Nothing here guesses
    // at the new state.
    if (result.ok) setMessage(null)
    else if (result.reason === 'already-reserved') setMessage(RACE_MESSAGE)
    else if (result.reason === 'already-holds') setMessage(LIMIT_MESSAGE)
    else setMessage(FAILURE_MESSAGE)
  }

  const fade = 'transition-opacity duration-150 ease-out'

  return (
    <div className={`${GUEST_CARD_CLASS} relative min-h-44`}>
      <div
        className={[
          'flex flex-1 flex-col',
          fade,
          naming ? 'pointer-events-none opacity-0' : 'opacity-100',
        ].join(' ')}
      >
        <GuestWishContent wish={wish} />

        <div className="mt-auto flex flex-col items-start gap-2 pt-4">
          {reservation?.mine ? (
            <>
              <StaticBadge variant="outline">Заброньовано тобою</StaticBadge>
              {/* No confirmation step — symmetric to the «✓» on the owner's own
                  screen, per §5.4: a light, immediately reversible action. */}
              <Button
                variant="outline"
                disabled={pending}
                tabIndex={naming ? -1 : 0}
                onClick={() => {
                  setMessage(null)
                  setPending(true)
                  void onCancel().finally(() => setPending(false))
                }}
              >
                Скасувати бронювання
              </Button>
            </>
          ) : reservation ? (
            <StaticBadge variant="soft">
              Заброньовано: {reservation.guestName}
            </StaticBadge>
          ) : holdsReservation ? null : (
            // The fourth state — free, but this guest already holds their one
            // reservation — renders nothing at all, not a disabled button: the
            // card should read as an ordinary wish rather than as something
            // withheld (§4's table).
            <Button
              variant="outline"
              tabIndex={naming ? -1 : 0}
              onClick={() => {
                setMessage(null)
                onOpenPrompt()
              }}
            >
              Забронювати
            </Button>
          )}

          {/* Mid Gray, never Ember: losing a race is news, not a failure the
              guest caused — the same reasoning as the «N / 30» notice. */}
          {message ? <p className="text-body text-mid-gray">{message}</p> : null}
        </div>
      </div>

      {/* ---- name prompt face ---- */}
      <div
        className={[
          'absolute inset-0 flex flex-col justify-center p-card',
          fade,
          naming ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        aria-hidden={!naming}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void confirm()
          }}
        >
          {/* Submitting the form is what makes Enter confirm, rather than a
              keydown handler — the browser already has that behaviour, and it
              respects the disabled button for free. */}
          <TextField
            id={`guest-name-${wish.id}`}
            ref={inputRef}
            label="Як тебе звати?"
            value={name}
            maxLength={GUEST_NAME_MAX_LENGTH}
            autoComplete="off"
            tabIndex={naming ? 0 : -1}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              tabIndex={naming ? 0 : -1}
              onClick={close}
            >
              Скасувати
            </Button>
            <Button
              type="submit"
              disabled={!canConfirm}
              tabIndex={naming ? 0 : -1}
            >
              Підтвердити
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
