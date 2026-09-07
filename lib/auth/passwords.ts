import 'server-only'

import bcrypt from 'bcryptjs'

/** docs/stage-2.md §3. */
export const PASSWORD_MIN_LENGTH = 8

/**
 * bcrypt hashes at most the first 72 *bytes* of input and silently ignores the
 * rest. Left alone that is a real weakness: two different long passwords
 * sharing a 72-byte prefix would both authenticate. We reject instead of
 * truncating, so nobody is issued a credential that is quietly weaker than what
 * they typed. The bound is in bytes, not characters — Cyrillic is two bytes per
 * character in UTF-8, so a 40-character Ukrainian password already exceeds it.
 */
export const PASSWORD_MAX_BYTES = 72

const BCRYPT_COST = 12

export function passwordByteLength(password: string): number {
  return new TextEncoder().encode(password).length
}

export function isPasswordAcceptable(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    passwordByteLength(password) <= PASSWORD_MAX_BYTES
  )
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST)
}

export function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
