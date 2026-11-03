import assert from 'node:assert/strict';
import test from 'node:test';
import type { CanvasSection } from '../types/canvas';
import {
  BOX_HEAD,
  CARD_H,
  CARD_W,
  boundsOf,
  boxHeight,
  boxWidth,
  clampCamera,
  colsForWidth,
  fitCamera,
  freeSpot,
  isOnScreen,
  overlaps,
  slotIndexAt,
  slotPosition,
  zoomCamera,
} from './canvasBoard';

const section: CanvasSection = { id: 's', name: 'Best', x: 100, y: 50, cols: 2, createdAt: '2026-01-01T00:00:00.000Z' };

test('box size follows its columns and cards', () => {
  assert.equal(colsForWidth(boxWidth(3)), 3);
  assert.equal(colsForWidth(1), 1);
  assert.equal(colsForWidth(100_000), 6);
  assert.ok(boxHeight(2, 0) > BOX_HEAD);
  assert.equal(boxHeight(2, 1), boxHeight(2, 2));
  assert.ok(boxHeight(2, 3) > boxHeight(2, 2));
});

test('slots and the slot under a point agree', () => {
  for (let i = 0; i < 5; i++) {
    const p = slotPosition(section, i);
    assert.equal(slotIndexAt(section, { x: p.x + CARD_W / 2, y: p.y + CARD_H / 2 }, 5), i);
  }

  assert.equal(slotIndexAt(section, { x: section.x + 2000, y: section.y + 2000 }, 3), 3);
  assert.equal(slotIndexAt(section, { x: section.x - 50, y: section.y }, 3), 0);
});

test('fitCamera centres the content and clampCamera keeps one screen of slack', () => {
  const content = { x: 0, y: 0, w: 1000, h: 500 };
  const view = { width: 1200, height: 800 };
  const cam = fitCamera(content, view, 50, 1);

  assert.equal(cam.z, 1);
  assert.equal(cam.x, 100);
  assert.equal(cam.y, 150);

  const far = clampCamera({ x: 99_999, y: -99_999, z: 1 }, content, view);
  assert.equal(far.x, view.width);
  assert.equal(far.y, -content.h);
  assert.deepEqual(clampCamera(cam, content, view), cam);
});

test('zoomCamera keeps the point under the pointer still', () => {
  const cam = { x: 10, y: 20, z: 1 };
  const at = { x: 300, y: 200 };
  const next = zoomCamera(cam, 2, at, 0.1, 4);
  const before = { x: (at.x - cam.x) / cam.z, y: (at.y - cam.y) / cam.z };
  const after = { x: (at.x - next.x) / next.z, y: (at.y - next.y) / next.z };

  assert.deepEqual(after, before);
  assert.equal(zoomCamera(cam, 100, at, 0.1, 4).z, 4);
});

test('isOnScreen', () => {
  const view = { width: 800, height: 600 };
  assert.ok(isOnScreen({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 0, z: 1 }, view));
  assert.ok(!isOnScreen({ x: 0, y: 0, w: 10, h: 10 }, { x: 900, y: 0, z: 1 }, view));
});

test('freeSpot moves a card off anything it would cover', () => {
  const blocks = [{ x: 0, y: 0, w: CARD_W, h: CARD_H }];
  const spot = freeSpot({ x: 20, y: 20 }, blocks);

  assert.ok(!overlaps({ ...spot, w: CARD_W, h: CARD_H }, blocks[0]));
  assert.ok(Math.hypot(spot.x - 20, spot.y - 20) < 400);
  assert.deepEqual(freeSpot({ x: 1000, y: 1000 }, blocks), { x: 1000, y: 1000 });
});

test('boundsOf', () => {
  assert.equal(boundsOf([]), null);
  assert.deepEqual(boundsOf([{ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: -5, w: 5, h: 5 }]), { x: 0, y: -5, w: 25, h: 15 });
});
