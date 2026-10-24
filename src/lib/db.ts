import pg from 'pg';
import { SCHEMA_SQL } from './schema';

/** pg 8 treats require/prefer/verify-ca as verify-full and warns until the string says so. */
function normalizeSslMode(url: string): string {
  return url.replace(/([?&])sslmode=(?:prefer|require|verify-ca)\b/gi, '$1sslmode=verify-full');
}

const databaseUrl = process.env.DATABASE_URL;

export const pool = new pg.Pool({
  connectionString: databaseUrl && normalizeSslMode(databaseUrl),
  max: 5,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 10_000,
});

let migrating: Promise<void> | null = null;

/** Create the tables once per server process. The schema is safe to re-run. */
export function ensureMigrated(): Promise<void> {
  if (!databaseUrl) return Promise.reject(new Error('DATABASE_URL is not set.'));
  migrating ??= pool.query(SCHEMA_SQL).then(
    () => undefined,
    (error) => {
      migrating = null;
      throw error;
    },
  );

  return migrating;
}
