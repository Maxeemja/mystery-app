import type { DefaultSession } from 'next-auth'

/**
 * `session.user.id` is not part of Auth.js's default shape; the `session`
 * callback in auth.ts puts it there, and this tells TypeScript about it so
 * `requireUserId()` doesn't have to cast.
 */
declare module 'next-auth' {
  interface Session {
    user: { id: string } & DefaultSession['user']
  }
}
