import { describe, it, expect } from 'vitest';
import { isMalformedRow, parseIndexKey, parseRow } from '../lib/inventory';

describe('parseRow', () => {
  it('parses a well-formed live entry', () => {
    const r = parseRow('u', 'layouts', 'id', JSON.stringify({ modifiedAt: 1, sizeBytes: 2 }));
    expect(r.tombstone).toBe(false);
    expect(isMalformedRow(r)).toBe(false);
    expect(r.entry.modifiedAt).toBe(1);
  });

  it('parses a tombstone entry', () => {
    const r = parseRow(
      'u',
      'layouts',
      'id',
      JSON.stringify({ modifiedAt: 1, sizeBytes: 0, deletedAt: 5 })
    );
    expect(r.tombstone).toBe(true);
  });

  it('flags wrong-typed modifiedAt as malformed', () => {
    const r = parseRow('u', 'layouts', 'id', JSON.stringify({ modifiedAt: 'now', sizeBytes: 2 }));
    expect(isMalformedRow(r)).toBe(true);
  });

  it('flags null sizeBytes as malformed', () => {
    const r = parseRow('u', 'layouts', 'id', JSON.stringify({ modifiedAt: 1, sizeBytes: null }));
    expect(isMalformedRow(r)).toBe(true);
  });

  it('flags non-finite modifiedAt as malformed', () => {
    const r = parseRow('u', 'layouts', 'id', '{"modifiedAt":1e9999,"sizeBytes":10}');
    expect(isMalformedRow(r)).toBe(true);
  });

  it('flags non-finite deletedAt as malformed', () => {
    const r = parseRow('u', 'layouts', 'id', '{"modifiedAt":1,"sizeBytes":0,"deletedAt":1e9999}');
    expect(isMalformedRow(r)).toBe(true);
  });

  it('flags unparseable JSON as malformed', () => {
    const r = parseRow('u', 'layouts', 'id', 'not-json');
    expect(isMalformedRow(r)).toBe(true);
  });
});

describe('parseIndexKey', () => {
  it.each(['layouts', 'designs', 'baseplates'] as const)('parses a %s index key', (kind) => {
    expect(parseIndexKey(`users:abc123:index:${kind}`)).toEqual({ uid: 'abc123', kind });
  });

  it.each([
    'users:abc123:indexUpdatedAt',
    'users:abc123:tombstoneSweptAt',
    'users:abc123:profile',
    'users:abc123:sessions',
  ])('rejects the sibling key %s', (key) => {
    expect(parseIndexKey(key)).toBeNull();
  });

  it('rejects an unknown kind so a future index namespace is not read as rows', () => {
    expect(parseIndexKey('users:abc123:index:widgets')).toBeNull();
  });

  it('rejects malformed shapes', () => {
    expect(parseIndexKey('users:abc123:index')).toBeNull();
    expect(parseIndexKey('users::index:layouts')).toBeNull();
    expect(parseIndexKey('share:hash:abc')).toBeNull();
    expect(parseIndexKey('users:a:b:index:layouts')).toBeNull();
  });
});
