import { z } from 'zod';

export const canvasKindSchema = z.enum(['youtube', 'blog', 'article', 'podcast', 'other']);

const webUrl = z.url({ protocol: /^https?$/ }).max(2048);

export const canvasTileSchema = z.object({
  id: z.string().min(1).max(200),
  url: webUrl,
  title: z.string().min(1).max(300),
  kind: canvasKindSchema,
  status: z.enum(['active', 'done']),
  note: z.string().max(5000),
  /** Sort key, ascending, within the tile's section. Moving a tile changes only its own position, so a drag is one update. */
  position: z.number().finite(),
  createdAt: z.iso.datetime(),
  /** The section box the tile sits in. Null for a tile placed loose on the canvas, or one not placed yet. */
  sectionId: z.string().min(1).max(200).nullable().default(null),
  /** Canvas coordinates of a loose tile; null while it sits in a section. */
  x: z.number().finite().nullable().default(null),
  y: z.number().finite().nullable().default(null),
  /** Preview image from the link's page. Null until a preview was looked up, '' when the page has none. */
  image: z.union([webUrl, z.literal('')]).nullable().default(null),
});

export type CanvasTile = z.infer<typeof canvasTileSchema>;

export type CanvasKind = CanvasTile['kind'];

export type CanvasStatus = CanvasTile['status'];

/** A named box on the canvas. Its tiles flow into `cols` columns and its height follows them. */
export const canvasSectionSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().trim().min(1).max(100),
  x: z.number().finite(),
  y: z.number().finite(),
  cols: z.number().int().min(1).max(6),
  createdAt: z.iso.datetime(),
});

export type CanvasSection = z.infer<typeof canvasSectionSchema>;

/** What the server could read from a link's page; either part may be missing. */
export const linkPreviewSchema = z.object({
  title: z.string().max(300).nullable(),
  image: webUrl.nullable(),
});

export type LinkPreview = z.infer<typeof linkPreviewSchema>;

/** What the browser extension sends to save a link. The server fills in anything left out. */
export const saveLinkSchema = z.object({
  url: webUrl,
  title: z.string().trim().max(300).optional(),
  note: z.string().trim().max(5000).optional(),
  /** Missing or unknown: the first section, or a new "Links" section when there are none. */
  sectionId: z.string().min(1).max(200).optional(),
  /** The page's own preview image, read by the extension; saves a Microlink lookup. */
  image: webUrl.optional(),
});
