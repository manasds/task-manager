import { pool } from './db';
import type { CanvasSection, CanvasTile } from '../types/canvas';

interface DbTile {
  id: string;
  url: string;
  title: string;
  kind: CanvasTile['kind'];
  status: CanvasTile['status'];
  note: string;
  position: number;
  created_at: Date;
  section_id: string | null;
  x: number | null;
  y: number | null;
  image: string | null;
}

interface DbSection {
  id: string;
  name: string;
  x: number;
  y: number;
  cols: number;
  created_at: Date;
}

export async function listTiles(userId: string): Promise<CanvasTile[]> {
  const result = await pool.query<DbTile>(
    `SELECT id, url, title, kind, status, note, position, created_at, section_id, x, y, image
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
    sectionId: row.section_id,
    x: row.x,
    y: row.y,
    image: row.image,
  }));
}

export async function saveTile(userId: string, tile: CanvasTile): Promise<void> {
  await pool.query(
    `INSERT INTO canvas_tiles (user_id, id, url, title, kind, status, note, position, created_at, section_id, x, y, image)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (user_id, id) DO UPDATE
     SET url = $3, title = $4, kind = $5, status = $6, note = $7, position = $8,
         section_id = $10, x = $11, y = $12, image = $13, updated_at = now()`,
    [
      userId,
      tile.id,
      tile.url,
      tile.title,
      tile.kind,
      tile.status,
      tile.note,
      tile.position,
      tile.createdAt,
      tile.sectionId,
      tile.x,
      tile.y,
      tile.image,
    ]
  );
}

export async function deleteTile(userId: string, id: string): Promise<void> {
  await pool.query('DELETE FROM canvas_tiles WHERE user_id = $1 AND id = $2', [userId, id]);
}

export async function listSections(userId: string): Promise<CanvasSection[]> {
  const result = await pool.query<DbSection>(
    'SELECT id, name, x, y, cols, created_at FROM canvas_sections WHERE user_id = $1 ORDER BY created_at, id',
    [userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    x: row.x,
    y: row.y,
    cols: row.cols,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function saveSection(userId: string, section: CanvasSection): Promise<void> {
  await pool.query(
    `INSERT INTO canvas_sections (user_id, id, name, x, y, cols, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, id) DO UPDATE
     SET name = $3, x = $4, y = $5, cols = $6, updated_at = now()`,
    [userId, section.id, section.name, section.x, section.y, section.cols, section.createdAt]
  );
}

/** Delete a section and every tile in it, together. */
export async function deleteSection(userId: string, id: string): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM canvas_tiles WHERE user_id = $1 AND section_id = $2', [userId, id]);
    await client.query('DELETE FROM canvas_sections WHERE user_id = $1 AND id = $2', [userId, id]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
