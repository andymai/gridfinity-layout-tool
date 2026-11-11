import { describe, it, expect, beforeEach } from 'vitest';
import { binId } from '@/core/types';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { stampFor } from '@/shared/utils/roomLinkStamp';
import { readOwnCopyRevision, recordOwnCopyRevision } from './ownCopyRevision';

const KEY = 'gridfinity-owned-share-revisions';
const T1 = '2026-11-01T10:00:00.000Z';
const T2 = '2026-11-01T10:00:05.000Z';
const first = createTestLayout({ bins: [createTestBin({ id: binId('first') })] });
const second = createTestLayout({ bins: [createTestBin({ id: binId('second') })] });

describe('own copy revision', () => {
  beforeEach(() => {
    localStorage.removeItem(KEY);
  });

  it('is unknown for a share this browser never saved', () => {
    expect(readOwnCopyRevision('share-a')).toBeUndefined();
  });

  it('reads back the revision with the fingerprint of the saved layout, per share', () => {
    recordOwnCopyRevision('share-a', T1, first);
    recordOwnCopyRevision('share-b', T2, second);

    expect(readOwnCopyRevision('share-a')).toEqual(stampFor(first, T1));
    expect(readOwnCopyRevision('share-b')).toEqual(stampFor(second, T2));
  });

  it('moves forward to a later save', () => {
    recordOwnCopyRevision('share-a', T1, first);
    recordOwnCopyRevision('share-a', T2, second);

    expect(readOwnCopyRevision('share-a')).toEqual(stampFor(second, T2));
  });

  it('keeps a later save over an earlier one that finished last', () => {
    recordOwnCopyRevision('share-a', T2, second);
    recordOwnCopyRevision('share-a', T1, first);

    expect(readOwnCopyRevision('share-a')).toEqual(stampFor(second, T2));
  });

  it('reads a record without a fingerprint as a revision of no known layout', () => {
    localStorage.setItem(KEY, JSON.stringify({ 'share-a': T1 }));

    expect(readOwnCopyRevision('share-a')).toEqual({ linkUpdatedAt: T1 });
  });

  it('keeps a later record without a fingerprint over an earlier save', () => {
    localStorage.setItem(KEY, JSON.stringify({ 'share-a': T2 }));

    recordOwnCopyRevision('share-a', T1, first);

    expect(readOwnCopyRevision('share-a')).toEqual({ linkUpdatedAt: T2 });
  });

  it('treats unreadable storage as empty and recovers on the next record', () => {
    localStorage.setItem(KEY, '{not json');
    expect(readOwnCopyRevision('share-a')).toBeUndefined();

    recordOwnCopyRevision('share-a', T1, first);
    expect(readOwnCopyRevision('share-a')).toEqual(stampFor(first, T1));
  });

  it('ignores a stored value of another shape', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ 'share-a': 42, 'share-b': { linkUpdatedAt: T1, linkFingerprint: 7 } })
    );

    expect(readOwnCopyRevision('share-a')).toBeUndefined();
    expect(readOwnCopyRevision('share-b')).toBeUndefined();
  });
});
