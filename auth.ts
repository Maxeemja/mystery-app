import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'

import { authenticate } from './lib/auth/users'

/**
 * Auth.js — docs/stage-2.md §3.
 *
 * JWT sessions rather than a database session table: the only thing the app
 * needs from a session is the user id, and a JWT keeps every request from
 * costing a Mongo round-trip just to resolve it. `strategy: 'jwt'` also puts
 * the session in an httpOnly cookie, so page scripts can't read it.
 *
 * `authorized` is what protects the app's routes; see `middleware.ts` for how
 * it is wired in.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email
        const password = credentials?.password
        if (typeof email !== 'string' || typeof password !== 'string') {
          return null
        }

        const user = await authenticate(email, password)
        if (!user) return null

        // Only these three fields ever reach the token. `passwordHash` is not
        // among them and must never be — the JWT is readable by anyone holding
        // the cookie.
        return { id: user.id, name: user.name, email: user.email }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      // `user` is only present on the sign-in pass; afterwards the id is
      // already on the token and must be carried forward.
      if (user?.id) token.sub = user.id
      return token
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub
      return session
    },
  },
})
