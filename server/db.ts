import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('DATABASE_URL is not set. API routes that need Postgres will fail.');
}

export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
});

export async function migrate(): Promise<void> {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  const sql = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');
  await pool.query(sql);
}
