import { describe, it, expect } from 'vitest';
import { claimRoomSaves, roomSavesShare } from './roomSaveClaims';

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

  it('counts a release only once', () => {
    const first = claimRoomSaves('share-a');
    const second = claimRoomSaves('share-a');

    first();
    first();
    expect(roomSavesShare('share-a')).toBe(true);

    second();
  });
});
