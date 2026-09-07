import 'server-only'

import { ObjectId } from 'mongodb'

import { normalizeEmail } from './email'
import { hashPassword, verifyPassword } from './passwords'
import { generateShareToken } from './shareToken'
import { usersCollection, type UserDoc } from '../db/mongo'

/** Mongo's duplicate-key error. */
const DUPLICATE_KEY = 11000

export interface CreatedUser {
  id: string
  name: string
  email: string
  shareToken: string
}

export class EmailTakenError extends Error {
  constructor() {
    super('Email already registered')
    this.name = 'EmailTakenError'
  }
}

/**
 * Creates an account.
 *
 * Uniqueness is enforced by catching the unique index's duplicate-key error,
 * not by a `findOne` beforehand. A pre-check is a race: two concurrent
 * registrations for the same address both see "free" and both insert. The index
 * is the only thing that can actually decide this, so it is what we ask.
 *
 * If the index is missing (`npm run db:indexes` never ran), the insert simply
 * succeeds and duplicates appear. That failure is loud rather than silent
 * because `findByEmail` then resolves logins to whichever document Mongo
 * returns first — so the check below turns it into an explicit error instead.
 */
export async function createUser(
  name: string,
  rawEmail: string,
  password: string
): Promise<CreatedUser> {
  const email = normalizeEmail(rawEmail)
  const users = await usersCollection()

  const doc: UserDoc = {
    _id: new ObjectId(),
    email,
    passwordHash: await hashPassword(password),
    name,
    shareToken: generateShareToken(),
    createdAt: new Date(),
  }

  try {
    await users.insertOne(doc)
  } catch (error) {
    if (isDuplicateKey(error)) throw new EmailTakenError()
    throw error
  }

  return {
    id: doc._id.toHexString(),
    name: doc.name,
    email: doc.email,
    shareToken: doc.shareToken,
  }
}

/**
 * Resolves an email+password pair to a user, or null.
 *
 * Returns a single null for every failure — unknown address and wrong password
 * alike. Distinguishing them would turn the login form into an oracle for
 * checking whether an address has an account here (docs/stage-2.md §3).
 *
 * When the email is unknown we still run a bcrypt comparison against a dummy
 * hash. Without it, "no such user" returns in microseconds while a real user
 * with a wrong password takes ~250ms at cost 12, and that timing difference
 * leaks exactly what the identical message is hiding.
 */
export async function authenticate(
  rawEmail: string,
  password: string
): Promise<{ id: string; name: string; email: string } | null> {
  const email = normalizeEmail(rawEmail)
  const users = await usersCollection()
  const doc = await users.findOne({ email })

  if (!doc) {
    await verifyPassword(password, DUMMY_HASH)
    return null
  }

  const ok = await verifyPassword(password, doc.passwordHash)
  if (!ok) return null

  return { id: doc._id.toHexString(), name: doc.name, email: doc.email }
}

/** Backs the guest screen at `/w/{token}`. */
export async function findByShareToken(
  shareToken: string
): Promise<{ id: string; name: string } | null> {
  const users = await usersCollection()
  const doc = await users.findOne(
    { shareToken },
    { projection: { name: 1 } }
  )
  if (!doc) return null
  return { id: doc._id.toHexString(), name: doc.name }
}

export async function findShareTokenByUserId(
  userId: string
): Promise<string | null> {
  if (!ObjectId.isValid(userId)) return null
  const users = await usersCollection()
  const doc = await users.findOne(
    { _id: new ObjectId(userId) },
    { projection: { shareToken: 1 } }
  )
  return doc?.shareToken ?? null
}

/**
 * A real bcrypt hash of a value nobody can supply, used only to spend the same
 * time on the unknown-email path as on a genuine comparison.
 */
const DUMMY_HASH =
  '$2b$12$C6UzMDM.H6dfI/f/IKcEe.6Q4Kx8bnV4qYlKZ3Xz9L1oR2sT4uV6y'

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === DUPLICATE_KEY
  )
}
