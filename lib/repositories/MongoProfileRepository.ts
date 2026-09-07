import 'server-only'

import { ObjectId } from 'mongodb'

import { usersCollection } from '../db/mongo'
import type { Profile } from '../domain/types'
import type { ProfileRepository } from './types'

/**
 * Stage-2 implementation of `ProfileRepository`.
 *
 * There is no separate profiles collection: on stage 2 a profile is the public
 * face of a `User` document, so `name` and `email` are read and written there.
 * Splitting them out would mean keeping two records in sync for no gain.
 *
 * Consequently `save` only ever *updates*. Account creation belongs to
 * registration, which also has to set `passwordHash` and `shareToken` — fields
 * this interface knows nothing about, and which must never default.
 */
export class MongoProfileRepository implements ProfileRepository {
  async get(userId: string): Promise<Profile | null> {
    if (!ObjectId.isValid(userId)) return null

    const users = await usersCollection()
    const doc = await users.findOne(
      { _id: new ObjectId(userId) },
      { projection: { name: 1, email: 1 } }
    )
    if (!doc) return null
    return { userId, name: doc.name, email: doc.email }
  }

  async save(profile: Profile): Promise<Profile> {
    if (!ObjectId.isValid(profile.userId)) {
      throw new Error('Invalid user id')
    }

    const users = await usersCollection()
    // Only `name` is written back. Email is the login identity and is bound to
    // a unique index — changing it is an account operation, not a profile edit,
    // and the app offers no UI for it.
    const updated = await users.findOneAndUpdate(
      { _id: new ObjectId(profile.userId) },
      { $set: { name: profile.name } },
      { returnDocument: 'after', projection: { name: 1, email: 1 } }
    )
    if (!updated) throw new Error(`User ${profile.userId} not found`)

    return { userId: profile.userId, name: updated.name, email: updated.email }
  }
}
