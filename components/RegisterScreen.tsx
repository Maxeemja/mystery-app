'use client'

/**
 * «Створити акаунт» — docs/stage-2.md §3.1.
 *
 * Replaces the stage-1 Init screen. The name field is character-for-character
 * the Init behavior: same `validateName`, same `nameHelperText`, same 15-char
 * hard cap on the input (interactions.md §1.1). Nothing about that rule is
 * reimplemented here.
 */

import { useActionState } from 'react'
import Link from 'next/link'
import { useState } from 'react'

import { Button } from './ui/Button'
import { TextField } from './ui/TextField'
import { registerAction, type AuthFormState } from '../app/actions/auth'
import { looksLikeEmail } from '../lib/auth/email'
import { NAME_MAX_LENGTH, nameHelperText, validateName } from '../lib/domain'

/** Kept in step with PASSWORD_MIN_LENGTH; that module is server-only. */
const PASSWORD_MIN_LENGTH = 8

export function RegisterScreen() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    registerAction,
    {}
  )

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const canSubmit =
    validateName(name).valid &&
    looksLikeEmail(email) &&
    password.length >= PASSWORD_MIN_LENGTH &&
    !pending

  return (
    <main className="mx-auto flex min-h-screen max-w-page items-center px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-heading-sm font-semibold text-ink sm:text-heading">
          Створити акаунт
        </h1>

        <form action={formAction} className="mt-8">
          <div className="mb-5">
            <TextField
              id="register-name"
              name="name"
              label="Як тебе звати?"
              value={name}
              maxLength={NAME_MAX_LENGTH}
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
              helper={
                state.field === 'name' ? state.error : nameHelperText(name)
              }
              tone={state.field === 'name' ? 'error' : 'muted'}
            />
          </div>

          <div className="mb-5">
            <TextField
              id="register-email"
              name="email"
              type="email"
              label="Імейл"
              value={email}
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              helper={state.field === 'email' ? state.error : null}
              tone="error"
            />
          </div>

          <div className="mb-6">
            <TextField
              id="register-password"
              name="password"
              type="password"
              label="Пароль"
              value={password}
              autoComplete="new-password"
              onChange={(event) => setPassword(event.target.value)}
              helper={
                state.field === 'password'
                  ? state.error
                  : `Мінімум ${PASSWORD_MIN_LENGTH} символів`
              }
              tone={state.field === 'password' ? 'error' : 'muted'}
            />
          </div>

          {state.error && !state.field ? (
            <p className="mb-4 text-body text-ember">{state.error}</p>
          ) : null}

          <Button type="submit" disabled={!canSubmit} fullWidth>
            Створити акаунт
          </Button>
        </form>

        <p className="mt-6 text-body text-mid-gray">
          Вже є акаунт?{' '}
          <Link href="/login" className="text-ink underline">
            Увійти
          </Link>
        </p>
      </div>
    </main>
  )
}
