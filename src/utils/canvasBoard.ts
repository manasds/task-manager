import type { CanvasSection } from '../types/canvas';

/** Card size on the board, in canvas units (pixels at 100% zoom). */
export const CARD_W = 224;
export const CARD_H = 196;

/** Section box header height, inner padding, gap between cards, and the body height of an empty box. */
export const BOX_HEAD = 56;
export const BOX_PAD = 18;
export const BOX_GAP = 14;
export const EMPTY_BODY = 140;
export const MAX_COLS = 6;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Where the board is drawn: canvas point (x, y) appears at screen (x * z + cam.x, y * z + cam.y). */
export interface Camera {
  x: number;
  y: number;
  z: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export function boxWidth(cols: number): number {
  return 2 * BOX_PAD + cols * CARD_W + (cols - 1) * BOX_GAP;
}

export function boxHeight(cols: number, count: number): number {
  if (count === 0) return BOX_HEAD + EMPTY_BODY;

  return BOX_HEAD + Math.ceil(count / cols) * (CARD_H + BOX_GAP) - BOX_GAP + BOX_PAD;
}

export function boxRect(section: CanvasSection, count: number): Rect {
  return { x: section.x, y: section.y, w: boxWidth(section.cols), h: boxHeight(section.cols, count) };
}

/** Top-left of the card in grid slot `index` of a box. */
export function slotPosition(section: CanvasSection, index: number): Point {
  return {
    x: section.x + BOX_PAD + (index % section.cols) * (CARD_W + BOX_GAP),
    y: section.y + BOX_HEAD + Math.floor(index / section.cols) * (CARD_H + BOX_GAP),
  };
}

/** The grid slot under a canvas point in a box, clamped to 0…count. */
export function slotIndexAt(section: CanvasSection, point: Point, count: number): number {
  const col = Math.min(
    section.cols - 1,
    Math.max(0, Math.floor((point.x - section.x - BOX_PAD + BOX_GAP / 2) / (CARD_W + BOX_GAP)))
  );

  const row = Math.max(0, Math.floor((point.y - section.y - BOX_HEAD + BOX_GAP / 2) / (CARD_H + BOX_GAP)));

  return Math.min(count, row * section.cols + col);
}

/** Columns for a box dragged to `width` canvas units wide. */
export function colsForWidth(width: number): number {
  return Math.min(MAX_COLS, Math.max(1, Math.round((width - 2 * BOX_PAD + BOX_GAP) / (CARD_W + BOX_GAP))));
}

export function contains(rect: Rect, point: Point): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

/** True when the two rectangles come closer than `margin`. */
export function overlaps(a: Rect, b: Rect, margin = 0): boolean {
  return a.x < b.x + b.w + margin && a.x + a.w + margin > b.x && a.y < b.y + b.h + margin && a.y + a.h + margin > b.y;
}

export function boundsOf(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Camera that centres `rect` in the view with `pad` screen pixels around it, never zooming past `maxZoom`. */
export function fitCamera(rect: Rect, view: Viewport, pad: number, maxZoom: number): Camera {
  const z = Math.min(maxZoom, Math.max(0.1, Math.min((view.width - 2 * pad) / rect.w, (view.height - 2 * pad) / rect.h)));

  return { z, x: (view.width - rect.w * z) / 2 - rect.x * z, y: (view.height - rect.h * z) / 2 - rect.y * z };
}

/** Keep at most one screen of empty canvas between the view and the content on every side. */
export function clampCamera(cam: Camera, content: Rect, view: Viewport): Camera {
  return {
    z: cam.z,
    x: Math.min(view.width - content.x * cam.z, Math.max(-(content.x + content.w) * cam.z, cam.x)),
    y: Math.min(view.height - content.y * cam.z, Math.max(-(content.y + content.h) * cam.z, cam.y)),
  };
}

/** Zoom by `factor` keeping the screen point `at` still. */
export function zoomCamera(cam: Camera, factor: number, at: Point, minZoom: number, maxZoom: number): Camera {
  const z = Math.min(maxZoom, Math.max(minZoom, cam.z * factor));

  return { z, x: at.x - (at.x - cam.x) * (z / cam.z), y: at.y - (at.y - cam.y) * (z / cam.z) };
}

export function isOnScreen(rect: Rect, cam: Camera, view: Viewport): boolean {
  return (
    rect.x * cam.z + cam.x < view.width &&
    (rect.x + rect.w) * cam.z + cam.x > 0 &&
    rect.y * cam.z + cam.y < view.height &&
    (rect.y + rect.h) * cam.z + cam.y > 0
  );
}

/** Space kept between a loose card and anything else. */
const LOOSE_MARGIN = 12;

/**
 * The nearest top-left to `wanted` where a loose card touches none of `blocks`,
 * searched outward in rings so a drop lands as close to where it was let go as it can.
 */
export function freeSpot(wanted: Point, blocks: Rect[]): Point {
  const free = (p: Point) => !blocks.some(b => overlaps({ x: p.x, y: p.y, w: CARD_W, h: CARD_H }, b, LOOSE_MARGIN));

  if (free(wanted)) return wanted;

  for (let r = 24; r < 6000; r += 24) {
    let best: Point | null = null;

    for (let a = 0; a < 360; a += 15) {
      const p = { x: wanted.x + r * Math.cos((a * Math.PI) / 180), y: wanted.y + r * Math.sin((a * Math.PI) / 180) };

      if (free(p) && (!best || Math.hypot(p.x - wanted.x, p.y - wanted.y) < Math.hypot(best.x - wanted.x, best.y - wanted.y))) {
        best = p;
      }
    }

    if (best) return best;
  }

  return wanted;
}
