import { redirect } from 'next/navigation'

import { RegisterScreen } from '../../components/RegisterScreen'
import { currentUserId } from '../../lib/auth/session'

/** Public route; a signed-in visitor has no business here. */
export default async function RegisterPage() {
  if (await currentUserId()) redirect('/')
  return <RegisterScreen />
}
