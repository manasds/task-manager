// Brings the database tables up to date (src/lib/schema.ts, safe to re-run). Requests no longer
// do this, so a visit doesn't wake Neon just to check the schema.
//
// `pnpm build` runs this first. On Vercel it migrates the deployment's DATABASE_URL, and a
// failure stops a production deploy. Anywhere else it does nothing unless you run
// `pnpm db:migrate`, which applies it to the DATABASE_URL in .env.
import { ensureMigrated, pool } from '../src/lib/db';

const requested = process.argv.includes('--run');
const onVercel = process.env.VERCEL === '1';
const production = process.env.VERCEL_ENV === 'production';

async function main(): Promise<void> {
  if (!requested && !onVercel) {
    console.log('Database migration skipped: not a Vercel build. Run `pnpm db:migrate` to apply it.');

    return;
  }

  if (!process.env.DATABASE_URL) {
    if (requested || production) throw new Error('DATABASE_URL is not set, so the schema cannot be applied.');
    console.log('Database migration skipped: this deployment has no DATABASE_URL.');

    return;
  }

  try {
    await ensureMigrated();
    console.log('Database schema applied.');
  } finally {
    await pool.end();
  }
}

void (async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
