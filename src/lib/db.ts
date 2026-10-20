import pg from 'pg';
import { SCHEMA_SQL } from './schema';

const { Pool } = pg;

const PLACEHOLDER_HOST = 'ep-xxx-pooler.region.aws.neon.tech';

/** Real Neon URI, or undefined when unset or still the example from .env.example. */
export function configuredDatabaseUrl(value = process.env.DATABASE_URL): string | undefined {
  const url = value?.trim();
  if (!url) return undefined;
  if (url.includes(PLACEHOLDER_HOST) || url.includes('://USER:PASSWORD@')) return undefined;
  return url;
}

const DATABASE_URL = configuredDatabaseUrl();

if (!DATABASE_URL) {
  console.warn(
    'DATABASE_URL is missing or still the Neon example. Local mode only until you paste a pooled connection string.',
  );
}

function isNeon(connectionString: string): boolean {
  return /neon\.tech/i.test(connectionString);
}

/** pg 8 treats require/prefer/verify-ca as verify-full and warns until the string says so. */
function normalizeSslMode(connectionString: string): string {
  return connectionString.replace(
    /([?&])sslmode=(?:prefer|require|verify-ca)\b/gi,
    '$1sslmode=verify-full',
  );
}

function poolConfig(connectionString: string | undefined): pg.PoolConfig {
  if (!connectionString) return { connectionString };
  const normalized = normalizeSslMode(connectionString);
  const neon = isNeon(normalized);
  const requireSsl = neon || /sslmode=verify-full/i.test(normalized);
  return {
    connectionString: normalized,
    max: neon ? 5 : 10,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
    ssl: requireSsl ? { rejectUnauthorized: true } : undefined,
  };
}

export const pool = new Pool(poolConfig(DATABASE_URL));

export async function migrate(): Promise<void> {
  if (!DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is required. Paste the pooled Neon connection string from the dashboard.',
    );
  }
  await pool.query(SCHEMA_SQL);
}

let migrating: Promise<void> | null = null;

export function ensureMigrated(): Promise<void> {
  if (!migrating) {
    migrating = migrate().catch((error) => {
      migrating = null;
      throw error;
    });
  }
  return migrating;
}
