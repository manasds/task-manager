import { configuredDatabaseUrl, ensureMigrated } from './lib/db';

export async function migrateOnBoot(): Promise<void> {
  if (!configuredDatabaseUrl()) return;
  try {
    await ensureMigrated();
  } catch (error) {
    console.error(
      'Postgres migration failed. The app will keep running; sign-in and sync stay unavailable.',
      error,
    );
  }
}
