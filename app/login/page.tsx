import { redirect } from 'next/navigation'

import { LoginScreen } from '../../components/LoginScreen'
import { currentUserId } from '../../lib/auth/session'

/** Public route; a signed-in visitor has no business here. */
export default async function LoginPage() {
  if (await currentUserId()) redirect('/')
  return <LoginScreen />
}
