import { headers } from 'next/headers';
import { auth } from './auth';

export async function getSessionUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image ?? undefined,
  };
}
