'use server'

import { AuthError } from 'next-auth'
import { isRedirectError } from 'next/dist/client/components/redirect-error'

import { signIn, signOut } from '../../auth'
import { looksLikeEmail, normalizeEmail } from '../../lib/auth/email'
import { isPasswordAcceptable, PASSWORD_MIN_LENGTH } from '../../lib/auth/passwords'
import { createUser, EmailTakenError } from '../../lib/auth/users'
import { validateName } from '../../lib/domain'

/**
 * Registration and login — docs/stage-2.md §3.1, §3.2.
 *
 * Every field is re-validated here even though the forms disable their submit
 * buttons until things look valid. The client check is a convenience; this is
 * the boundary, and it is reachable directly.
 *
 * Returned errors are the exact Ember strings from the spec. Nothing here ever
 * returns or logs the password.
 */

export interface AuthFormState {
  error?: string
  field?: 'name' | 'email' | 'password'
}

export async function registerAction(
  _previous: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const rawName = String(formData.get('name') ?? '')
  const rawEmail = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')

  const name = validateName(rawName)
  if (!name.valid) {
    return { error: 'Імʼя від 3 до 15 символів', field: 'name' }
  }
  if (!looksLikeEmail(rawEmail)) {
    return { error: 'Схоже, це не імейл', field: 'email' }
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { error: `Пароль мінімум ${PASSWORD_MIN_LENGTH} символів`, field: 'password' }
  }
  if (!isPasswordAcceptable(password)) {
    // Past bcrypt's 72-byte input limit; see lib/auth/passwords.ts.
    return { error: 'Пароль задовгий', field: 'password' }
  }

  try {
    await createUser(name.value, rawEmail, password)
  } catch (error) {
    if (error instanceof EmailTakenError) {
      return { error: 'Такий імейл уже зареєстрований', field: 'email' }
    }
    throw error
  }

  // Sign the new account straight in, then land on the hub.
  return signInAndRedirect(rawEmail, password)
}

export async function loginAction(
  _previous: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const rawEmail = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')
  return signInAndRedirect(rawEmail, password)
}

async function signInAndRedirect(
  rawEmail: string,
  password: string
): Promise<AuthFormState> {
  try {
    await signIn('credentials', {
      email: normalizeEmail(rawEmail),
      password,
      redirectTo: '/',
    })
  } catch (error) {
    // `signIn` signals a successful redirect by throwing; rethrowing is how the
    // navigation actually happens. Swallowing this would leave the user on the
    // form after a valid login.
    if (isRedirectError(error)) throw error
    if (error instanceof AuthError) {
      // Deliberately identical for an unknown address and a wrong password —
      // see the note in lib/auth/users.ts:authenticate.
      return { error: 'Невірний імейл або пароль' }
    }
    throw error
  }

  return {}
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: '/login' })
}
