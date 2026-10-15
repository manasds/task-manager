import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('DATABASE_URL is not set. API routes that need Postgres will fail.');
}

function isNeon(connectionString: string): boolean {
  return /neon\.tech/i.test(connectionString);
}

function poolConfig(connectionString: string | undefined): pg.PoolConfig {
  if (!connectionString) return { connectionString };
  const neon = isNeon(connectionString);
  const requireSsl = neon || /sslmode=require/i.test(connectionString);
  return {
    connectionString,
    max: neon ? 5 : 10,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
    ssl: requireSsl ? { rejectUnauthorized: true } : undefined,
  };
}

export const pool = new Pool(poolConfig(DATABASE_URL));

export async function migrate(): Promise<void> {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  const sql = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');
  await pool.query(sql);
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
