import { pool } from './db.js';
import type { DocumentRecord, PersistedDocument } from '../src/types/document.ts';
import { emptyDocument, isValidDocument } from '../src/utils/syncPolicy.ts';

export async function getDocument(userId: string): Promise<DocumentRecord | null> {
  const result = await pool.query<{
    document: PersistedDocument;
    revision: string;
    updated_at: Date;
  }>('SELECT document, revision, updated_at FROM user_documents WHERE user_id = $1', [userId]);
  const row = result.rows[0];
  if (!row) return null;
  return {
    document: row.document,
    revision: Number(row.revision),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function saveDocument(
  userId: string,
  document: PersistedDocument,
  baseRevision: number
): Promise<{ ok: true; record: DocumentRecord } | { ok: false; conflict: DocumentRecord }> {
  if (!isValidDocument(document)) {
    throw new Error('Invalid document');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query<{
      document: PersistedDocument;
      revision: string;
      updated_at: Date;
    }>(
      'SELECT document, revision, updated_at FROM user_documents WHERE user_id = $1 FOR UPDATE',
      [userId]
    );

    if (existing.rows[0]) {
      const currentRevision = Number(existing.rows[0].revision);
      if (currentRevision !== baseRevision) {
        await client.query('ROLLBACK');
        return {
          ok: false,
          conflict: {
            document: existing.rows[0].document,
            revision: currentRevision,
            updatedAt: existing.rows[0].updated_at.toISOString(),
          },
        };
      }

      const updated = await client.query<{
        document: PersistedDocument;
        revision: string;
        updated_at: Date;
      }>(
        `UPDATE user_documents
         SET document = $2, revision = revision + 1, updated_at = now()
         WHERE user_id = $1
         RETURNING document, revision, updated_at`,
        [userId, document]
      );
      await client.query('COMMIT');
      const row = updated.rows[0];
      return {
        ok: true,
        record: {
          document: row.document,
          revision: Number(row.revision),
          updatedAt: row.updated_at.toISOString(),
        },
      };
    }

    if (baseRevision !== 0) {
      await client.query('ROLLBACK');
      return {
        ok: false,
        conflict: {
          document: emptyDocument(),
          revision: 0,
          updatedAt: new Date().toISOString(),
        },
      };
    }

    const inserted = await client.query<{
      document: PersistedDocument;
      revision: string;
      updated_at: Date;
    }>(
      `INSERT INTO user_documents (user_id, document, revision)
       VALUES ($1, $2, 1)
       RETURNING document, revision, updated_at`,
      [userId, document]
    );
    await client.query('COMMIT');
    const row = inserted.rows[0];
    return {
      ok: true,
      record: {
        document: row.document,
        revision: Number(row.revision),
        updatedAt: row.updated_at.toISOString(),
      },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
