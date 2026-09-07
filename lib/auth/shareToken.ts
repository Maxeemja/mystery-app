import 'server-only'

import { randomBytes } from 'node:crypto'

/**
 * The share token is the *only* thing standing between a list and anyone on the
 * internet: there is no other access check on `/w/{token}` (docs/stage-2.md
 * §5.1). So it comes from `randomBytes`, not `Math.random()` — the latter is a
 * seeded PRNG whose output is predictable from previous values, which would let
 * someone who owns one list derive others.
 *
 * The alphabet excludes the characters that are easy to confuse when a link is
 * read aloud or retyped (0/O, 1/l/I). 10 characters over a 32-symbol alphabet
 * is ~50 bits — far past guessing range for something with no enumeration
 * endpoint.
 */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const TOKEN_LENGTH = 10

export function generateShareToken(): string {
  // Rejection sampling: taking `byte % ALPHABET.length` directly would bias the
  // first 256 % 31 symbols, since 256 is not a multiple of the alphabet size.
  const limit = 256 - (256 % ALPHABET.length)
  let token = ''

  while (token.length < TOKEN_LENGTH) {
    for (const byte of randomBytes(TOKEN_LENGTH)) {
      if (byte >= limit) continue
      token += ALPHABET[byte % ALPHABET.length]
      if (token.length === TOKEN_LENGTH) break
    }
  }

  return token
}
