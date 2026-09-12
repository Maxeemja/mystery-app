import 'server-only'

import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'

/**
 * Guest identity — docs/stage-2.md §5.4, docs/prompter-task-reservations.md §3.
 *
 * The guest counterpart of `lib/auth/session.ts`: the one place a guest
 * identity enters the data layer, so that no action ever accepts a `guestId`
 * argument from the caller. A client-supplied guest id would let anyone cancel
 * a stranger's reservation just by naming it.
 *
 * ## Read and write are deliberately two functions
 *
 * `cookies()` is readable during a Server Component render but not writable —
 * Next.js throws if `.set()` is called outside a Server Action or Route
 * Handler. So the render path (`readGuestId`, used by `/w/{token}` to decide
 * whose reservation is whose) and the issue path (`issueGuestId`, used only by
 * the reserve action) are separate. A single "get or create" helper would look
 * tidier and would crash on every page view.
 *
 * ## Why it is issued so late
 *
 * Only on the *first successful* reservation — not on page view, not
 * speculatively before the insert. A visitor who only reads a list leaves with
 * no cookie at all, and a reservation attempt that loses the race writes no
 * cookie either, so a browser never carries an identity that identifies
 * nothing.
 */

export const GUEST_COOKIE = 'guestId'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

/** Read-only. Safe during a Server Component render. */
export async function readGuestId(): Promise<string | null> {
  const store = await cookies()
  return store.get(GUEST_COOKIE)?.value ?? null
}

/**
 * A fresh, unguessable id. Not derived from anything the client sends: a
 * `guestId` that could be predicted or reconstructed would let one guest cancel
 * another's reservation, which is the only thing it protects.
 */
export function generateGuestId(): string {
  return randomBytes(24).toString('base64url')
}

/**
 * Persist a guest id. Server Action context only.
 *
 * httpOnly so it cannot be read (or forged) from `document.cookie` — which also
 * means "is this my reservation?" has to be answered on the server, and it is,
 * during the `/w/{token}` render. `sameSite=lax` rather than `strict` because
 * a guest arrives by following a shared link from a messenger, and `strict`
 * would drop the cookie on exactly that navigation.
 */
export async function issueGuestId(guestId: string): Promise<void> {
  const store = await cookies()
  store.set(GUEST_COOKIE, guestId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    secure: process.env.NODE_ENV === 'production',
  })
}
