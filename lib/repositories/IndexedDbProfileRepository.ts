import { STORE_PROFILES, request, withStore } from '../db'
import type { Profile } from '../domain/types'
import type { ProfileRepository } from './types'

/** Stage-1 implementation of `ProfileRepository` backed by IndexedDB. */
export class IndexedDbProfileRepository implements ProfileRepository {
  async get(userId: string): Promise<Profile | null> {
    return withStore(STORE_PROFILES, 'readonly', async ([store]) => {
      const found = await request(
        store!.get(userId) as IDBRequest<Profile | undefined>
      )
      return found ?? null
    })
  }

  async save(profile: Profile): Promise<Profile> {
    return withStore(STORE_PROFILES, 'readwrite', async ([store]) => {
      await request(store!.put(profile))
      return profile
    })
  }
}
