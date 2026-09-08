/**
 * Repository contracts — docs/tech-stack.md §4.
 *
 * This is the seam that makes stage 2 a data migration rather than a rewrite:
 * components depend on these interfaces only, so an implementation can move
 * from IndexedDB to Mongo-behind-Server-Actions without a caller caring.
 *
 * ## Ownership
 *
 * Every method takes `userId` as its first argument, including `update` and
 * `remove`, which on stage 1 took only an `id`. That was safe when there was
 * exactly one local user. It is not safe with accounts: Server Actions are
 * publicly invocable endpoints, so an unscoped `remove(id)` lets anyone who
 * guesses a wish id delete a stranger's data.
 *
 * The scope is part of the *contract* rather than something the Mongo
 * implementation digs out of the session itself, for two reasons. A repository
 * that imports Auth.js stops being a data-access seam — it can no longer be
 * driven by a migration script or a test, and the IndexedDB implementation
 * behind the same interface has no session to read at all. And putting it in
 * the signature makes the requirement checkable: a call site that has no owner
 * to pass does not compile.
 *
 * Implementations must fold the scope into the query itself (`{_id, userId}`),
 * not check it afterwards, so a mismatch matches zero documents rather than
 * relying on the caller to compare. `userId` must always be resolved from the
 * session on the server — never accepted from the client, which would make it
 * an impersonation parameter.
 */

import type { NewWish, Profile, Wish, WishPatch } from '../domain/types'

export interface WishRepository {
  list(userId: string): Promise<Wish[]>
  /**
   * One wish by id, scoped to its owner. Returns null both when the id belongs
   * to somebody else and when it does not exist — the caller must not be able
   * to tell those apart, or the difference becomes a way to probe which ids are
   * real (docs/prompter-task-edit-wish.md §5).
   */
  find(userId: string, id: string): Promise<Wish | null>
  create(userId: string, data: NewWish): Promise<Wish>
  update(userId: string, id: string, patch: WishPatch): Promise<Wish>
  /**
   * Returns the wish that was removed, or null when nothing matched (wrong
   * owner, or already gone).
   *
   * It returns the document rather than void so the caller can destroy the
   * wish's Cloudinary file, which needs the `imagePublicId` that is about to
   * disappear. Reading it back separately first would be a race: two concurrent
   * deletes would both read the id and both try to destroy the same file.
   */
  remove(userId: string, id: string): Promise<Wish | null>
  /**
   * Total wishes for the owner, done ones included — it backs the 30-wish hard
   * lock (docs/stage-2.md §4), which is a storage limit rather than a product
   * rule, so completed wishes take up a slot like any other.
   */
  count(userId: string): Promise<number>
}

export interface ProfileRepository {
  get(userId: string): Promise<Profile | null>
  save(profile: Profile): Promise<Profile>
}
