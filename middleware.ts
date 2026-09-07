import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'

/**
 * Route protection — docs/stage-2.md §3, «Захист маршрутів».
 *
 * A separate, minimal NextAuth instance rather than importing the one from
 * `auth.ts`: middleware runs on the Edge runtime, and the Credentials provider
 * there pulls in bcrypt and the Mongo driver, neither of which can run on Edge.
 * Reading the JWT cookie needs no provider at all, so none is configured here.
 * The session's *contents* are still trusted — the cookie is signed with
 * AUTH_SECRET, so it cannot be forged client-side.
 *
 * This is a redirect, not the security boundary. Server Actions enforce
 * ownership themselves via `requireUserId()`; middleware only spares a signed-out
 * visitor a screen that would fail to load anyway.
 */
const { auth } = NextAuth({ session: { strategy: 'jwt' }, providers: [] })

/** Everything else is public: `/login`, `/register`, `/w/{token}`. */
const PROTECTED = ['/', '/add', '/share']

export default auth((request) => {
  const { pathname } = request.nextUrl
  const isProtected = PROTECTED.includes(pathname)
  if (!isProtected || request.auth) return NextResponse.next()

  const login = new URL('/login', request.nextUrl)
  return NextResponse.redirect(login)
})

export const config = {
  /**
   * Skip Next's internals, the auth endpoints themselves, and anything that
   * looks like a static file — matching those would add a JWT decode to every
   * asset request for no benefit.
   */
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.).*)'],
}
