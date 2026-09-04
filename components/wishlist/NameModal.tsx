'use client'

/**
 * Name edit — docs/interactions.md §2.7, docs/spec.md §3.4.
 *
 * Validation is identical to Init and is not re-implemented: both call
 * `validateName` / `nameHelperText` from lib/domain.
 */

import { useEffect, useRef, useState } from 'react'

import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { TextField } from '../ui/TextField'
import { NAME_MAX_LENGTH, nameHelperText, validateName } from '../../lib/domain'

interface NameModalProps {
  currentName: string
  onClose: () => void
  onSave: (name: string) => Promise<void>
}

export function NameModal({ currentName, onClose, onSave }: NameModalProps) {
  const [name, setName] = useState(currentName)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Autofocus with the caret at the end, not selecting the existing name —
  // the user is usually amending, not replacing.
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
  }, [])

  const canSave = validateName(name).valid && !saving

  async function submit() {
    if (!canSave) return
    setSaving(true)
    setFailed(false)
    try {
      await onSave(validateName(name).value)
      onClose()
    } catch {
      setFailed(true)
      setSaving(false)
    }
  }

  return (
    <Modal title="Змінити ім’я" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <TextField
          id="edit-name"
          ref={inputRef}
          value={name}
          maxLength={NAME_MAX_LENGTH}
          autoComplete="off"
          onChange={(event) => setName(event.target.value)}
          helper={failed ? 'Не вдалося зберегти' : nameHelperText(name)}
          tone={failed ? 'error' : 'muted'}
        />
        <div className="mt-5 flex justify-end">
          <Button type="submit" disabled={!canSave}>
            Зберегти
          </Button>
        </div>
      </form>
    </Modal>
  )
}
