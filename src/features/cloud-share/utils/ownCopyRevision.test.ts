import { describe, it, expect, beforeEach } from 'vitest';
import { readOwnCopyRevision, recordOwnCopyRevision } from './ownCopyRevision';

const KEY = 'gridfinity-owned-share-revisions';
const T1 = '2026-11-01T10:00:00.000Z';
const T2 = '2026-11-01T10:00:05.000Z';

describe('own copy revision', () => {
  beforeEach(() => {
    localStorage.removeItem(KEY);
  });

  it('is unknown for a share this browser never saved', () => {
    expect(readOwnCopyRevision('share-a')).toBeUndefined();
  });

  it('reads back what was recorded, per share', () => {
    recordOwnCopyRevision('share-a', T1);
    recordOwnCopyRevision('share-b', T2);

    expect(readOwnCopyRevision('share-a')).toBe(T1);
    expect(readOwnCopyRevision('share-b')).toBe(T2);
  });

  it('moves forward to a later revision', () => {
    recordOwnCopyRevision('share-a', T1);
    recordOwnCopyRevision('share-a', T2);

    expect(readOwnCopyRevision('share-a')).toBe(T2);
  });

  it('keeps a later revision over an earlier one that finished last', () => {
    recordOwnCopyRevision('share-a', T2);
    recordOwnCopyRevision('share-a', T1);

    expect(readOwnCopyRevision('share-a')).toBe(T2);
  });

  it('treats unreadable storage as empty and recovers on the next record', () => {
    localStorage.setItem(KEY, '{not json');
    expect(readOwnCopyRevision('share-a')).toBeUndefined();

    recordOwnCopyRevision('share-a', T1);
    expect(readOwnCopyRevision('share-a')).toBe(T1);
  });

  it('ignores a stored value that is not a string', () => {
    localStorage.setItem(KEY, JSON.stringify({ 'share-a': 42 }));

    expect(readOwnCopyRevision('share-a')).toBeUndefined();
  });
});
