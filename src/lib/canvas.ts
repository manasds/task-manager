import { pool } from './db';
import { canvasTileSchema, type CanvasTile } from '../types/canvas';

interface DbTile {
  id: string;
  url: string;
  title: string;
  kind: CanvasTile['kind'];
  status: CanvasTile['status'];
  note: string;
  position: number;
  created_at: Date;
}

export async function listTiles(userId: string): Promise<CanvasTile[]> {
  const result = await pool.query<DbTile>(
    `SELECT id, url, title, kind, status, note, position, created_at
     FROM canvas_tiles WHERE user_id = $1 ORDER BY position, created_at DESC`,
    [userId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    url: row.url,
    title: row.title,
    kind: row.kind,
    status: row.status,
    note: row.note,
    position: row.position,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function saveTile(userId: string, tile: CanvasTile): Promise<void> {
  await pool.query(
    `INSERT INTO canvas_tiles (user_id, id, url, title, kind, status, note, position, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (user_id, id) DO UPDATE
     SET url = $3, title = $4, kind = $5, status = $6, note = $7, position = $8, updated_at = now()`,
    [userId, tile.id, tile.url, tile.title, tile.kind, tile.status, tile.note, tile.position, tile.createdAt]
  );
}

export async function deleteTile(userId: string, id: string): Promise<void> {
  await pool.query('DELETE FROM canvas_tiles WHERE user_id = $1 AND id = $2', [userId, id]);
}

/** A clean tile from a request body, or null if anything is off. */
export function parseTile(body: unknown, id: string): CanvasTile | null {
  const result = canvasTileSchema.safeParse(body);
  return result.success && result.data.id === id ? result.data : null;
}
