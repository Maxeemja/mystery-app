import { InitScreen } from '../../components/InitScreen'

/**
 * Server shell only — the screen itself has to be client-side, because whether
 * a profile exists is knowable only in the browser (docs/tech-stack.md §3).
 * That is also why this gate cannot be a server redirect.
 */
export default function InitPage() {
  return <InitScreen />
}
