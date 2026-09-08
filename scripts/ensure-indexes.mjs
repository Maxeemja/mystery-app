/**
 * Creates the indexes from docs/stage-2.md §2. Run with `npm run db:indexes`.
 *
 * Deliberately a one-off script rather than something the app does at startup.
 * `createIndex` is idempotent but not free: doing it on every cold start adds a
 * round-trip to the critical path of the first request in each serverless
 * container, and concurrent containers would race to build the same index. Index
 * creation is a deploy-time concern, so it lives at deploy time.
 *
 * Safe to re-run: an existing index with the same spec and options is a no-op.
 */

import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('MONGODB_URI is not set. Fill in .env.local first.')
  process.exit(1)
}

const client = new MongoClient(uri)

try {
  await client.connect()
  const db = client.db('wishlist')

  await db.collection('users').createIndex({ email: 1 }, { unique: true })
  await db.collection('users').createIndex({ shareToken: 1 }, { unique: true })
  await db.collection('wishes').createIndex({ userId: 1 })

  // Migration idempotency (docs/stage-2.md §6). Partial, so it constrains only
  // migrated documents — natively created wishes have no such field, and a
  // plain unique index would treat all of them as duplicate nulls and reject
  // every wish after the first. Scoped by userId because two accounts can
  // legitimately migrate from the same browser's local store.
  await db.collection('wishes').createIndex(
    { userId: 1, migratedFromLocalId: 1 },
    {
      unique: true,
      partialFilterExpression: { migratedFromLocalId: { $exists: true } },
    }
  )

  for (const name of ['users', 'wishes']) {
    const indexes = await db.collection(name).indexes()
    const described = indexes.map(
      (index) => `${index.name}${index.unique ? ' (unique)' : ''}`
    )
    console.log(`${name}: ${described.join(', ')}`)
  }
} finally {
  await client.close()
}
