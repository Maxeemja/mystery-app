'use client'

/**
 * «Увійти» — docs/stage-2.md §3.2.
 *
 * No «Забули пароль?» link: password reset is not implemented and cannot be
 * with this stack (docs/stage-2.md §3.4). A link that goes nowhere is worse
 * than its absence.
 *
 * The failure message is one string for every cause. See the note in
 * lib/auth/users.ts for why the two cases must not be distinguished.
 */

import { useActionState, useState } from 'react'
import Link from 'next/link'

import { Button } from './ui/Button'
import { TextField } from './ui/TextField'
import { loginAction, type AuthFormState } from '../app/actions/auth'

export function LoginScreen() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    loginAction,
    {}
  )

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const canSubmit = email !== '' && password !== '' && !pending

  return (
    <main className="mx-auto flex min-h-screen max-w-page items-center px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-heading-sm font-semibold text-ink sm:text-heading">
          Увійти
        </h1>

        <form action={formAction} className="mt-8">
          <div className="mb-5">
            <TextField
              id="login-email"
              name="email"
              type="email"
              label="Імейл"
              value={email}
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="mb-6">
            <TextField
              id="login-password"
              name="password"
              type="password"
              label="Пароль"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {state.error ? (
            <p className="mb-4 text-body text-ember">{state.error}</p>
          ) : null}

          <Button type="submit" disabled={!canSubmit} fullWidth>
            Увійти
          </Button>
        </form>

        <p className="mt-6 text-body text-mid-gray">
          Немає акаунта?{' '}
          <Link href="/register" className="text-ink underline">
            Створити
          </Link>
        </p>
      </div>
    </main>
  )
}
