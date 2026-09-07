import 'server-only'

import { auth } from '../../auth'

/**
 * The single place a `userId` enters the data layer.
 *
 * Every Server Action calls this instead of accepting an owner argument. That
 * is the whole ownership guarantee from Stage 0: the repository contract
 * demands a `userId`, and this is the only thing allowed to supply one. A
 * client-supplied owner would just be an impersonation parameter.
 *
 * Throws rather than returning null so a caller cannot forget to check — an
 * unauthenticated action fails loudly instead of falling through to a query
 * scoped by `undefined`.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) throw new UnauthenticatedError()
  return userId
}

/** Non-throwing variant, for screens that render differently when signed in. */
export async function currentUserId(): Promise<string | null> {
  const session = await auth()
  return session?.user?.id ?? null
}

export class UnauthenticatedError extends Error {
  constructor() {
    super('Not signed in')
    this.name = 'UnauthenticatedError'
  }
}
