import OrbitApp from '@/App';
import { CloudUser } from '@/types/document';
import { ensureMigrated } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export default async function HomePage() {
  let user: CloudUser | null = null;
  let sessionError = false;

  try {
    await ensureMigrated();
    user = await getSessionUser();
  } catch (error) {
    // Let the client fall back to the last known user instead of failing the page.
    console.error(error);
    sessionError = true;
  }

  return <OrbitApp initialUser={user} sessionError={sessionError} />;
}
