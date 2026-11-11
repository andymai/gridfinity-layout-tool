import { describe, it, expect } from 'vitest';
import type { Layout } from '@/core/types';
import { binId, gridUnits } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import {
  isLaterRevision,
  resolveJoin,
  revisionOfCopy,
  roomLayoutFingerprint,
  stampFor,
} from './roomLinkStamp';

const T1 = '2026-11-01T10:00:00.000Z';
const T2 = '2026-11-01T10:00:05.000Z';

function withGridBin(id: string, x = 0): Layout {
  return createTestLayout({ bins: [createTestBin({ id: binId(id), x: gridUnits(x) })] });
}

describe('roomLayoutFingerprint', () => {
  it('is the same for a layout and its JSON round trip', () => {
    const layout = { ...withGridBin('a'), printBedDepth: undefined };
    const roundTripped = JSON.parse(JSON.stringify(layout)) as Layout;
    expect(roomLayoutFingerprint(roundTripped)).toBe(roomLayoutFingerprint(layout));
  });

  it('changes when a grid bin moves', () => {
    expect(roomLayoutFingerprint(withGridBin('a', 1))).not.toBe(
      roomLayoutFingerprint(withGridBin('a', 0))
    );
  });

  it('ignores staging bins', () => {
    const staged = createTestLayout({
      bins: [...withGridBin('a').bins, createTestBin({ id: binId('s'), layerId: STAGING_ID })],
    });
    expect(roomLayoutFingerprint(staged)).toBe(roomLayoutFingerprint(withGridBin('a')));
  });
});

describe('stampFor', () => {
  it('records the revision with the fingerprint', () => {
    const layout = withGridBin('a');
    expect(stampFor(layout, T1)).toEqual({
      linkUpdatedAt: T1,
      linkFingerprint: roomLayoutFingerprint(layout),
    });
  });

  it('leaves the revision out when it is unknown', () => {
    expect(Object.keys(stampFor(withGridBin('a'), undefined))).toEqual(['linkFingerprint']);
  });
});

describe('revisionOfCopy', () => {
  const saved = withGridBin('saved');

  it('gives the revision to the layout that was saved at it', () => {
    expect(revisionOfCopy(saved, stampFor(saved, T1))).toBe(T1);
  });

  it('gives the revision to a JSON round trip of that layout', () => {
    const roundTripped = JSON.parse(JSON.stringify(saved)) as Layout;
    expect(revisionOfCopy(roundTripped, stampFor(saved, T1))).toBe(T1);
  });

  it('gives no revision to a different layout', () => {
    expect(revisionOfCopy(withGridBin('other'), stampFor(saved, T1))).toBeUndefined();
  });

  it('gives no revision when the save names no layout', () => {
    expect(revisionOfCopy(saved, { linkUpdatedAt: T1 })).toBeUndefined();
  });

  it('gives no revision without a save', () => {
    expect(revisionOfCopy(saved, undefined)).toBeUndefined();
  });
});

describe('isLaterRevision', () => {
  it('is true only for a strictly later timestamp', () => {
    expect(isLaterRevision(T2, T1)).toBe(true);
    expect(isLaterRevision(T1, T1)).toBe(false);
    expect(isLaterRevision(T1, T2)).toBe(false);
  });

  it('is false when either side is missing or unreadable', () => {
    expect(isLaterRevision(undefined, T1)).toBe(false);
    expect(isLaterRevision(T2, undefined)).toBe(false);
    expect(isLaterRevision('not a date', T1)).toBe(false);
    expect(isLaterRevision(T2, 'not a date')).toBe(false);
  });
});

describe('resolveJoin', () => {
  const saved = withGridBin('saved');
  const savedStamp = stampFor(saved, T1);

  describe('a room without a stamp', () => {
    it('keeps the room when it has bins on the grid, whatever the copy', () => {
      expect(
        resolveJoin({ copy: withGridBin('copy'), copyRevision: T2, room: saved, stamp: {} })
      ).toBe('adopt-room');
    });

    it('takes a copy with bins into a room with none', () => {
      const stagingOnly = createTestLayout({ bins: [createTestBin({ layerId: STAGING_ID })] });
      expect(
        resolveJoin({ copy: saved, copyRevision: undefined, room: stagingOnly, stamp: {} })
      ).toBe('push-copy');
    });

    it('keeps the room when neither has bins on the grid', () => {
      expect(
        resolveJoin({
          copy: createTestLayout(),
          copyRevision: T2,
          room: createTestLayout(),
          stamp: {},
        })
      ).toBe('adopt-room');
    });
  });

  describe('a stamped room', () => {
    it('keeps edits the link does not have, even against a later copy', () => {
      const edited = withGridBin('collaborator-edit');
      expect(
        resolveJoin({
          copy: withGridBin('copy'),
          copyRevision: T2,
          room: edited,
          stamp: savedStamp,
        })
      ).toBe('adopt-room');
    });

    it('keeps the room over a copy of the revision it recorded', () => {
      expect(
        resolveJoin({ copy: withGridBin('copy'), copyRevision: T1, room: saved, stamp: savedStamp })
      ).toBe('adopt-room');
    });

    it('keeps the room over an older copy', () => {
      const older = '2026-11-01T09:00:00.000Z';
      expect(
        resolveJoin({
          copy: withGridBin('copy'),
          copyRevision: older,
          room: saved,
          stamp: savedStamp,
        })
      ).toBe('adopt-room');
    });

    it('takes a copy from a later link revision', () => {
      expect(
        resolveJoin({ copy: withGridBin('copy'), copyRevision: T2, room: saved, stamp: savedStamp })
      ).toBe('push-copy');
    });

    it('keeps the room when the later copy has the same content', () => {
      expect(resolveJoin({ copy: saved, copyRevision: T2, room: saved, stamp: savedStamp })).toBe(
        'adopt-room'
      );
    });

    it('keeps the room when the copy has no revision', () => {
      expect(
        resolveJoin({
          copy: withGridBin('copy'),
          copyRevision: undefined,
          room: saved,
          stamp: savedStamp,
        })
      ).toBe('adopt-room');
    });

    it('keeps the room when its own revision is unknown', () => {
      expect(
        resolveJoin({
          copy: withGridBin('copy'),
          copyRevision: T2,
          room: saved,
          stamp: stampFor(saved, undefined),
        })
      ).toBe('adopt-room');
    });
  });
});
