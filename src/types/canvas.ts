import { z } from 'zod';

export const canvasTileSchema = z.object({
  id: z.string().min(1).max(200),
  url: z.url({ protocol: /^https?$/ }).max(2048),
  title: z.string().min(1).max(300),
  kind: z.enum(['youtube', 'blog', 'article', 'podcast', 'other']),
  status: z.enum(['active', 'done']),
  note: z.string().max(5000),
  /** Sort key, ascending. Moving a tile changes only its own position, so a drag is one update. */
  position: z.number().finite(),
  createdAt: z.iso.datetime(),
});

export type CanvasTile = z.infer<typeof canvasTileSchema>;
export type CanvasKind = CanvasTile['kind'];
export type CanvasStatus = CanvasTile['status'];
