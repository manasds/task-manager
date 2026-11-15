import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { pool } from './db';
import { MAX_EXTENSION_KEYS_PER_USER } from './limits';
import { EXTENSION_TOKEN_PREFIX } from '../utils/extensionAuth';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * A new key for one extension, shown once to the extension and stored here only as a hash.
 * The user keeps at most MAX_EXTENSION_KEYS_PER_USER keys; the oldest beyond that stop working.
 */
export async function createExtensionToken(userId: string, extensionId: string): Promise<string> {
  const token = EXTENSION_TOKEN_PREFIX + randomBytes(32).toString('base64url');

  // The DELETE sees the keys from before this INSERT, so it keeps one fewer than the cap.
  await pool.query(
    `WITH created AS (
       INSERT INTO extension_tokens (id, user_id, token_hash, extension_id) VALUES ($1, $2, $3, $4)
     )
     DELETE FROM extension_tokens
     WHERE user_id = $2 AND id NOT IN (
       SELECT id FROM extension_tokens WHERE user_id = $2 ORDER BY created_at DESC, id LIMIT $5
     )`,
    [randomUUID(), userId, hash(token), extensionId, MAX_EXTENSION_KEYS_PER_USER - 1]
  );

  return token;
}

/**
 * The user a key belongs to, or null for an unknown or revoked key. `last_used_at` is only
 * rewritten once it is an hour old, so most extension requests only read.
 */
export async function userIdForExtensionToken(token: string): Promise<string | null> {
  const result = await pool.query<{ user_id: string }>(
    `WITH found AS (
       SELECT id, user_id, last_used_at FROM extension_tokens WHERE token_hash = $1
     ), touched AS (
       UPDATE extension_tokens SET last_used_at = now()
       WHERE id IN (
         SELECT id FROM found WHERE last_used_at IS NULL OR last_used_at < now() - interval '1 hour'
       )
     )
     SELECT user_id FROM found`,
    [hash(token)]
  );

  return result.rows[0]?.user_id ?? null;
}

export async function revokeExtensionToken(token: string): Promise<void> {
  await pool.query('DELETE FROM extension_tokens WHERE token_hash = $1', [hash(token)]);
}
