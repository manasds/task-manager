import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isSameSiteRequest, requestHost } from './requestOrigin';

describe('isSameSiteRequest', () => {
  it('allows reads from anywhere', () => {
    assert.equal(isSameSiteRequest('GET', 'https://evil.example', 'tasky.manasbuilds.me'), true);
  });

  it('allows a write from the same host', () => {
    assert.equal(isSameSiteRequest('POST', 'https://tasky.manasbuilds.me', 'tasky.manasbuilds.me'), true);
    assert.equal(isSameSiteRequest('delete', 'http://localhost:3000', 'localhost:3000'), true);
  });

  it('blocks a write from another site or a sibling subdomain', () => {
    assert.equal(isSameSiteRequest('POST', 'https://evil.example', 'tasky.manasbuilds.me'), false);
    assert.equal(isSameSiteRequest('PUT', 'https://other.manasbuilds.me', 'tasky.manasbuilds.me'), false);
    assert.equal(isSameSiteRequest('POST', 'http://localhost:3001', 'localhost:3000'), false);
  });

  it('blocks a null or unreadable Origin, and a write with no host to compare', () => {
    assert.equal(isSameSiteRequest('POST', 'null', 'tasky.manasbuilds.me'), false);
    assert.equal(isSameSiteRequest('POST', 'https://tasky.manasbuilds.me', null), false);
  });

  it('allows a write without an Origin, which only non-browser clients send', () => {
    assert.equal(isSameSiteRequest('POST', null, 'tasky.manasbuilds.me'), true);
  });
});

describe('requestHost', () => {
  it('prefers the first forwarded host over Host', () => {
    assert.equal(requestHost(new Headers({ host: 'internal:3000', 'x-forwarded-host': 'tasky.manasbuilds.me, proxy' })), 'tasky.manasbuilds.me');
    assert.equal(requestHost(new Headers({ host: 'localhost:3000' })), 'localhost:3000');
  });
});
