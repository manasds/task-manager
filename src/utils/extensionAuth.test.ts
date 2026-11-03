import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILT_IN_EXTENSION_IDS, allowedExtensionIds, bearerToken, redirectExtensionId } from './extensionAuth';

const id = BUILT_IN_EXTENSION_IDS[0];
const allowed = allowedExtensionIds(undefined);

test('only an approved extension sign-in address is accepted', () => {
  assert.equal(redirectExtensionId(`https://${id}.chromiumapp.org/`, allowed), id);
  assert.equal(redirectExtensionId(`https://${id}.chromiumapp.org/cb?x=1`, allowed), id);
  assert.equal(redirectExtensionId(`https://${'a'.repeat(32)}.chromiumapp.org/`, allowed), null);
  assert.equal(redirectExtensionId(`http://${id}.chromiumapp.org/`, allowed), null);
  assert.equal(redirectExtensionId(`https://${id}.chromiumapp.org.evil.com/`, allowed), null);
  assert.equal(redirectExtensionId(`https://evil.com/${id}.chromiumapp.org/`, allowed), null);
  assert.equal(redirectExtensionId(`https://user@${id}.chromiumapp.org/`, allowed), null);
  assert.equal(redirectExtensionId('not a url', allowed), null);
});

test('extra extension ids come from a comma-separated list', () => {
  const store = 'b'.repeat(32);
  const ids = allowedExtensionIds(` ${store} , not-an-id ,`);

  assert.ok(ids.has(store));
  assert.ok(ids.has(id));
  assert.ok(!ids.has('not-an-id'));
  assert.equal(redirectExtensionId(`https://${store}.chromiumapp.org/`, ids), store);
});

test('bearerToken reads only Tasky extension keys', () => {
  assert.equal(bearerToken('Bearer tsk_abc'), 'tsk_abc');
  assert.equal(bearerToken('bearer   tsk_abc'), 'tsk_abc');
  assert.equal(bearerToken('Bearer other_abc'), null);
  assert.equal(bearerToken(null), null);
  assert.equal(bearerToken('tsk_abc'), null);
});
