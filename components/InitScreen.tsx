'use client'

/**
 * Init screen — docs/interactions.md §1, docs/spec.md §3.0.
 *
 * Shown exactly once, while no profile exists. Nothing else lives on it: no
 * logo, no nav, no second field.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from './ui/Button'
import { TextField } from './ui/TextField'
import { useProfile } from './useProfile'
import { NAME_MAX_LENGTH, nameHelperText, validateName } from '../lib/domain'
import { createProfileWithSeed, profileRepository, wishRepository } from '../lib/repositories'

export function InitScreen() {
  const router = useRouter()
  const { status, profile } = useProfile()

  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Guards direct navigation to /init once a profile exists: this screen must
  // never reappear, even with an empty wish list (interactions.md §1.3).
  useEffect(() => {
    if (status === 'ready' && profile) router.replace('/')
  }, [status, profile, router])

  useEffect(() => {
    if (status === 'ready' && !profile) inputRef.current?.focus()
  }, [status, profile])

  const canSubmit = validateName(name).valid && !saving

  async function submit() {
    if (!canSubmit) return
    setSaving(true)
    setStorageError(false)
    try {
      await createProfileWithSeed(validateName(name).value, {
        profiles: profileRepository,
        wishes: wishRepository,
      })
      // Fade out, then navigate — no loading screen, the write is local.
      setLeaving(true)
      setTimeout(() => router.replace('/'), 200)
    } catch {
      setStorageError(true)
      setSaving(false)
    }
  }

  // Nothing is rendered until we know whether a profile exists — otherwise the
  // Init form would flash for a frame on every reload of an existing install.
  if (status === 'loading' || (status === 'ready' && profile)) {
    return <main className="min-h-screen" />
  }

  return (
    <main
      className={[
        'mx-auto flex min-h-screen max-w-page items-center px-6',
        'transition-opacity duration-200 ease-out',
        leaving ? 'opacity-0' : 'opacity-100',
      ].join(' ')}
    >
      <div className="mx-auto w-full max-w-[420px]">
        <h1 className="text-heading-lg font-semibold sm:text-display">
          Як тебе звати?
        </h1>

        <form
          className="mt-8"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <TextField
            id="init-name"
            ref={inputRef}
            label="Твоє ім’я"
            value={name}
            maxLength={NAME_MAX_LENGTH}
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
            helper={storageError ? 'Не вдалося зберегти' : nameHelperText(name)}
            tone={storageError ? 'error' : 'muted'}
          />

          <div className="mt-6">
            <Button type="submit" disabled={!canSubmit} className="w-full sm:w-auto">
              Далі
            </Button>
          </div>
        </form>
      </div>
    </main>
  )
}
