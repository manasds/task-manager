import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { pool } from './db';
import { EXTENSION_TOKEN_PREFIX } from '../utils/extensionAuth';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/** A new key for one extension, shown once to the extension and stored here only as a hash. */
export async function createExtensionToken(userId: string, extensionId: string): Promise<string> {
  const token = EXTENSION_TOKEN_PREFIX + randomBytes(32).toString('base64url');
  await pool.query(
    'INSERT INTO extension_tokens (id, user_id, token_hash, extension_id) VALUES ($1, $2, $3, $4)',
    [randomUUID(), userId, hash(token), extensionId]
  );

  return token;
}

/** The user a key belongs to, or null for an unknown or revoked key. */
export async function userIdForExtensionToken(token: string): Promise<string | null> {
  const result = await pool.query<{ user_id: string }>(
    `UPDATE extension_tokens SET last_used_at = now()
     WHERE token_hash = $1 RETURNING user_id`,
    [hash(token)]
  );

  return result.rows[0]?.user_id ?? null;
}

export async function revokeExtensionToken(token: string): Promise<void> {
  await pool.query('DELETE FROM extension_tokens WHERE token_hash = $1', [hash(token)]);
}
