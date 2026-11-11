import assert from 'node:assert/strict';
import test from 'node:test';
import { findLink, readSharedLink } from './shareTarget';

test('findLink drops sentence punctuation and ignores non-web links', () => {
  assert.equal(findLink('see https://example.com/a?b=1.'), 'https://example.com/a?b=1');
  assert.equal(findLink('(https://example.com/x)'), 'https://example.com/x');
  assert.equal(findLink('ftp://example.com'), '');
  assert.equal(findLink('no link here'), '');
});

test('reads the url field when an app fills it', () => {
  assert.deepEqual(readSharedLink({ url: 'https://example.com/post', title: 'A post', text: '' }), {
    url: 'https://example.com/post',
    title: 'A post',
  });
});

test('finds the link in the text when the url field is empty', () => {
  assert.deepEqual(readSharedLink({ text: 'Great talk on caching https://youtu.be/abcdefghijk' }), {
    url: 'https://youtu.be/abcdefghijk',
    title: 'Great talk on caching',
  });
});

test('a title that is only the link counts as no title', () => {
  assert.deepEqual(readSharedLink({ title: 'https://example.com/a', text: 'https://example.com/a' }), {
    url: 'https://example.com/a',
    title: '',
  });
});

test('nothing shared gives an empty link to paste into', () => {
  assert.deepEqual(readSharedLink({}), { url: '', title: '' });
  assert.deepEqual(readSharedLink({ text: 'just some words' }), { url: '', title: 'just some words' });
});
