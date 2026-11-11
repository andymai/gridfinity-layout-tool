import { describe, it, expect } from 'vitest';
import { claimRoomSaves, roomClaimCount, roomSavesShare } from './roomSaveClaims';

describe('room save claims', () => {
  it('holds a share from claim to release', () => {
    expect(roomSavesShare('share-a')).toBe(false);

    const release = claimRoomSaves('share-a');
    expect(roomSavesShare('share-a')).toBe(true);
    expect(roomSavesShare('share-b')).toBe(false);

    release();
    expect(roomSavesShare('share-a')).toBe(false);
  });

  it('keeps the share claimed until every claim is released', () => {
    const first = claimRoomSaves('share-a');
    const second = claimRoomSaves('share-a');

    first();
    expect(roomSavesShare('share-a')).toBe(true);

    second();
    expect(roomSavesShare('share-a')).toBe(false);
  });

  it('moves the claim count forward on each claim, per share, and never back', () => {
    const before = roomClaimCount('share-count');
    const release = claimRoomSaves('share-count');
    expect(roomClaimCount('share-count')).toBe(before + 1);
    expect(roomClaimCount('share-other')).toBe(0);

    release();
    expect(roomClaimCount('share-count')).toBe(before + 1);

    claimRoomSaves('share-count')();
    expect(roomClaimCount('share-count')).toBe(before + 2);
  });

  it('counts a release only once', () => {
    const first = claimRoomSaves('share-a');
    const second = claimRoomSaves('share-a');

    first();
    first();
    expect(roomSavesShare('share-a')).toBe(true);

    second();
  });
});
