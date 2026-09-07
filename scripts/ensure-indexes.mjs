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
