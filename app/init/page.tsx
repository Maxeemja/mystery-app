import { redirect } from 'next/navigation'

/**
 * `/init` was stage 1's onboarding screen; `/register` replaces it
 * (docs/stage-2.md §3.1).
 *
 * Kept as a redirect rather than deleted: stage-1 users have this URL in their
 * history and possibly bookmarked, and a 404 on a route that worked yesterday
 * reads as a broken deploy. One file is cheap insurance against that.
 */
export default function InitPage() {
  redirect('/register')
}
