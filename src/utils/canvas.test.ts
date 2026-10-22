import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { canvasTileSchema } from '../types/canvas';
import { detectKind, getYouTubeId, positionBetween } from './canvas';

test('positionBetween', () => {
  assert.equal(positionBetween(2, 4), 3);
  assert.equal(positionBetween(2, undefined), 3);
  assert.equal(positionBetween(undefined, 2), 1);
  assert.equal(positionBetween(), 0);
});

test('detectKind and getYouTubeId', () => {
  assert.equal(detectKind('https://www.youtube.com/watch?v=abcdefghijk'), 'youtube');
  assert.equal(detectKind('https://example.com/post'), 'article');
  assert.equal(detectKind('not a url'), 'other');
  assert.equal(getYouTubeId('https://youtu.be/abcdefghijk'), 'abcdefghijk');
  assert.equal(getYouTubeId('https://example.com'), null);
});

describe('canvasTileSchema', () => {
  const valid = {
    id: 't1',
    url: 'https://example.com/post',
    title: 'A post',
    kind: 'article',
    status: 'active',
    note: '',
    position: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  test('accepts a valid tile', () => {
    assert.equal(canvasTileSchema.safeParse(valid).success, true);
  });

  test('rejects non-http(s) urls', () => {
    assert.equal(canvasTileSchema.safeParse({ ...valid, url: 'javascript:alert(1)' }).success, false);
    assert.equal(canvasTileSchema.safeParse({ ...valid, url: 'ftp://x' }).success, false);
  });

  test('rejects an empty title', () => {
    assert.equal(canvasTileSchema.safeParse({ ...valid, title: '' }).success, false);
  });

  test('rejects an unknown kind', () => {
    assert.equal(canvasTileSchema.safeParse({ ...valid, kind: 'video' }).success, false);
  });
});
