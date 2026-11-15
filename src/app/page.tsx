import OrbitApp from '@/App';
import { CloudUser } from '@/types/document';
import { getSessionUser } from '@/lib/session';

// The page reads the session cookie, so it must render per request, never at build time.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let user: CloudUser | null = null;
  let sessionError = false;

  try {
    // Without a session cookie this answers without touching Postgres, so visitors don't wake it.
    user = await getSessionUser();
  } catch (error) {
    // Let the client fall back to the last known user instead of failing the page.
    console.error(error);
    sessionError = true;
  }

  return <OrbitApp initialUser={user} sessionError={sessionError} />;
}
