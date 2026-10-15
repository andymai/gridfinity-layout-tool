import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';
import {
  LID_TOP_THICKNESS_STEP_MM,
  type LidAttachment,
  type LidConfig,
} from '@/features/bin-designer/types/lid';
import { assembledHeight, lidTopAboveRimMm } from '@/shared/printSettings/assembledHeight';
import {
  extraHeightForLidUnits,
  lidHeightUnitRange,
  lidUnitsCovering,
  syncedLidHeight,
  withSyncedLidHeight,
} from './lidHeightUnits';

function params(lid: Partial<LidConfig>, overrides: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    ...overrides,
    lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, ...lid },
  };
}

const CAP_LIDS: LidAttachment[] = ['friction', 'clickRails', 'magnetic', 'hinge'];

describe('lid height in units', () => {
  // Every lid that changes the plate under its top: a hinge's plate floor, a
  // stack grid, a tray cut into the plate, a thick plate, a short height unit.
  const variants: { name: string; lid: Partial<LidConfig>; overrides?: Partial<BinParams> }[] = [
    { name: 'plain', lid: {} },
    { name: 'stack grid', lid: { stackableTop: true } },
    { name: 'thick plate', lid: { topThicknessMm: 4 } },
    { name: 'tray', lid: { tray: { ...DEFAULT_BIN_PARAMS.lid.tray, enabled: true } } },
    { name: '5 mm units', lid: { stackableTop: true }, overrides: { heightUnitMm: 5 } },
    {
      name: 'low-profile grid',
      lid: { stackableTop: true },
      overrides: { base: { ...DEFAULT_BIN_PARAMS.base, lowProfile: true } },
    },
  ];

  for (const attachment of CAP_LIDS) {
    for (const v of variants) {
      it(`puts a ${attachment} lid (${v.name}) top N units above the rim`, () => {
        const p = params({ ...v.lid, attachment }, v.overrides);
        const range = lidHeightUnitRange(p);
        expect(range).not.toBeNull();
        if (!range) return;
        // Only a hinged lid under a short unit grows its plate floor in steps,
        // so a whole unit can fall inside one: the lid then clears it by less
        // than a step, and never falls short.
        const stepped = attachment === 'hinge' && p.heightUnitMm < 7;
        for (let units = range.min; units <= range.max; units++) {
          const extraHeightMm = extraHeightForLidUnits(p, units);
          const over =
            lidTopAboveRimMm({ ...p, lid: { ...p.lid, extraHeightMm } }) - units * p.heightUnitMm;
          expect(over).toBeGreaterThanOrEqual(-1e-6);
          expect(over).toBeLessThan(stepped ? LID_TOP_THICKNESS_STEP_MM : 1e-6);
        }
      });
    }
  }

  it('lines a 4u bin with a 1u lid up with the rim of a 5u bin', () => {
    for (const stackableTop of [false, true]) {
      const lidded = withSyncedLidHeight(params({ stackableTop, heightUnits: 1 }, { height: 4 }));
      const taller = { ...DEFAULT_BIN_PARAMS, height: 5 };
      expect(assembledHeight(lidded).totalMm).toBeCloseTo(assembledHeight(taller).totalMm, 3);
    }
  });

  it('starts the range where the stock lid already stands', () => {
    expect(lidHeightUnitRange(params({}))).toEqual({ min: 1, max: 14 });
    // A 6 mm plate under a stack grid is 11.7 mm tall before any extra height.
    expect(lidHeightUnitRange(params({ topThicknessMm: 6, stackableTop: true }))?.min).toBe(2);
  });

  it('has no range when no lid seats on the rim', () => {
    expect(lidHeightUnitRange(params({ enabled: false }))).toBeNull();
    expect(lidHeightUnitRange(params({ attachment: 'slide' }))).toBeNull();
    expect(
      lidHeightUnitRange(params({}, { base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } }))
    ).toBeNull();
  });

  it('sizes to the nearest reachable height without forgetting the one chosen', () => {
    const thickGrid = withSyncedLidHeight(
      params({ topThicknessMm: 6, stackableTop: true, heightUnits: 1 })
    );
    expect(syncedLidHeight(thickGrid)?.effectiveUnits).toBe(2);
    expect(thickGrid.lid.heightUnits).toBe(1);
    expect(syncedLidHeight(params({ heightUnits: 50 }))?.effectiveUnits).toBe(14);

    const thin = withSyncedLidHeight({
      ...thickGrid,
      lid: { ...thickGrid.lid, topThicknessMm: 0.8 },
    });
    expect(lidTopAboveRimMm(thin)).toBeCloseTo(thin.heightUnitMm, 6);
  });

  it('leaves the millimetre knob alone when units are off or nothing seats', () => {
    expect(syncedLidHeight(params({ extraHeightMm: 3 }))).toBeNull();
    const slide = params({ attachment: 'slide', heightUnits: 2, extraHeightMm: 3 });
    expect(withSyncedLidHeight(slide)).toBe(slide);
  });

  it('returns the same params when the lid height is already in sync', () => {
    const synced = withSyncedLidHeight(params({ heightUnits: 2 }));
    expect(synced.lid.extraHeightMm).toBeGreaterThan(0);
    expect(withSyncedLidHeight(synced)).toBe(synced);
  });

  it('follows a short height unit even where the stock lid sits below the rim', () => {
    // Under a 3 mm unit the stock lid's top is 1.9 mm below the rim.
    const short = withSyncedLidHeight(params({ heightUnits: 2 }, { heightUnitMm: 3 }));
    expect(lidTopAboveRimMm(short)).toBeCloseTo(6, 6);
  });

  it('will not switch a lid at the millimetre cap down to a shorter unit', () => {
    expect(lidUnitsCovering(params({ extraHeightMm: 100 }))).toBeNull();
  });

  it('switches to units at or above the lid as it stands', () => {
    expect(lidUnitsCovering(params({}))).toBe(1);
    expect(lidUnitsCovering(params({ extraHeightMm: extraHeightForLidUnits(params({}), 1) }))).toBe(
      1
    );
    expect(lidUnitsCovering(params({ extraHeightMm: 5 }))).toBe(2);
  });
});
