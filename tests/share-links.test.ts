import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildHostUrl, buildListUrl, buildParticipantUrl, displayUrl, parseItems, readTokenFromHash} from '../src/lib/share-links';

const origin = 'https://utrum.gr1618.io';

test('tokens travel in the #fragment, never in the path or query', () => {
  assert.equal(buildListUrl(origin, 'abc123def456'), `${origin}/l/abc123def456`);
  assert.equal(buildHostUrl(origin, 'abc123def456', 'hosttoken'), `${origin}/l/abc123def456/manage#hosttoken`);
  assert.equal(buildParticipantUrl(origin, 'abc123def456', 'mytoken'), `${origin}/l/abc123def456/me#mytoken`);
});

test('readTokenFromHash strips the # and survives bad encoding', () => {
  assert.equal(readTokenFromHash('#abc'), 'abc');
  assert.equal(readTokenFromHash(''), '');
  assert.equal(readTokenFromHash('#%E0%A4%A'), '');
});

test('displayUrl drops the protocol', () => {
  assert.equal(displayUrl(`${origin}/l/x`), 'utrum.gr1618.io/l/x');
});

test('parseItems: one per line, commas kept, bullets and duplicates dropped', () => {
  assert.deepEqual(parseItems('Arroz, feijão e farofa\n- Login lento\n2) Backup\n\n  login   LENTO  \n• Nota fiscal'), [
    'Arroz, feijão e farofa',
    'Login lento',
    'Backup',
    'Nota fiscal',
  ]);
  assert.deepEqual(parseItems(' \n\n'), []);
  assert.equal(parseItems('x'.repeat(200))[0].length, 120);
});
