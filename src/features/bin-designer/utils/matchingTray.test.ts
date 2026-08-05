import { describe, expect, it } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import type { BinParams } from '../types';
import { MATCHING_TRAY_HEIGHT_UNITS, matchingTrayParams } from './matchingTray';

function source(overrides: Partial<BinParams> = {}): BinParams {
  return { ...DEFAULT_BIN_PARAMS, ...overrides };
}

describe('matchingTrayParams', () => {
  it('copies every field the joint is sized from', () => {
    // These are the fields that decide whether the tray physically seats, so
    // they are copied rather than left to the user to retype.
    const tray = matchingTrayParams(
      source({ width: 3, depth: 5, gridUnitMm: 40, gridUnitMmY: 36, heightUnitMm: 8 })
    );
    expect(tray.width).toBe(3);
    expect(tray.depth).toBe(5);
    expect(tray.gridUnitMm).toBe(40);
    expect(tray.gridUnitMmY).toBe(36);
    expect(tray.heightUnitMm).toBe(8);
  });

  it('carries the fractional-edge placement across', () => {
    const tray = matchingTrayParams(source({ fractionalEdgeX: 'start', fractionalEdgeY: 'start' }));
    expect(tray.fractionalEdgeX).toBe('start');
    expect(tray.fractionalEdgeY).toBe('start');
  });

  it('uses a lid-compatible bottom', () => {
    const tray = matchingTrayParams(source());
    expect(tray.base.style).toBe('lid');
    expect(tray.base.trayBottom).toBeDefined();
  });

  it('inherits the source lid attachment so a click-rail bin gets a clicking tray', () => {
    const tray = matchingTrayParams(
      source({
        lid: {
          ...DEFAULT_BIN_PARAMS.lid,
          attachment: 'magnetic',
          clickRails: { front: false, back: true, left: false, right: true },
          clickRailCoverage: 75,
        },
      })
    );
    expect(tray.base.trayBottom?.attachment).toBe('magnetic');
    expect(tray.base.trayBottom?.clickRails).toEqual({
      front: false,
      back: true,
      left: false,
      right: true,
    });
    expect(tray.base.trayBottom?.clickRailCoverage).toBe(75);
  });

  it('does not give the tray a lid of its own — it IS the lid', () => {
    const tray = matchingTrayParams(source({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true } }));
    expect(tray.lid.enabled).toBe(false);
  });

  it('starts shallow and without a stacking lip', () => {
    const tray = matchingTrayParams(source({ height: 9 }));
    // A tray is an organiser, not a copy of the bin below.
    expect(tray.height).toBe(MATCHING_TRAY_HEIGHT_UNITS);
    expect(tray.base.stackingLip).toBe(false);
  });

  it('carries a polygon footprint so a shaped bin gets a shaped tray', () => {
    const cellMask = { cols: 4, rows: 4, cells: new Array(16).fill(true) } as never;
    const tray = matchingTrayParams(source({ cellMask }));
    expect(tray.cellMask).toBe(cellMask);
  });

  it('leaves the source design untouched', () => {
    const original = source({ width: 3 });
    const snapshot = JSON.stringify(original);
    matchingTrayParams(original);
    expect(JSON.stringify(original)).toBe(snapshot);
  });
});
