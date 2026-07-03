import { describe, it, expect } from 'vitest';
import {
  enumerateCutoutColorUnits,
  cutoutUnitKey,
  cutoutColorTag,
  cutoutOrdinalFromTag,
  resolveCutoutTriColor,
  anyCutoutColored,
  CUTOUT_COLOR_TAG_BASE,
} from './cutoutColorUnits';
import type { Cutout } from '@/shared/types/bin';

const cut = (o: Partial<Cutout>): Cutout => ({
  id: 'c',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 10,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...o,
});

describe('cutoutColorUnits', () => {
  it('keys a grouped cutout by groupId, others by id', () => {
    expect(cutoutUnitKey(cut({ id: 'a', groupId: null }))).toBe('a');
    expect(cutoutUnitKey(cut({ id: 'a', groupId: 'g1' }))).toBe('g1');
  });

  it('enumerates one unit per distinct key in first-appearance order', () => {
    const units = enumerateCutoutColorUnits([
      cut({ id: 'a' }),
      cut({ id: 'b', groupId: 'g1' }),
      cut({ id: 'c', groupId: 'g1' }),
      cut({ id: 'd' }),
    ]);
    expect(units.map((u) => u.key)).toEqual(['a', 'g1', 'd']);
  });

  it('adopts the first colored member for a group unit', () => {
    const units = enumerateCutoutColorUnits([
      cut({ id: 'b', groupId: 'g1' }),
      cut({ id: 'c', groupId: 'g1', color: '#ef4444', colorScope: 'floor' }),
    ]);
    expect(units[0]).toMatchObject({ key: 'g1', color: '#ef4444', colorScope: 'floor' });
  });

  it('defaults an uncolored unit to floorAndWalls scope', () => {
    expect(enumerateCutoutColorUnits([cut({ id: 'a' })])[0].colorScope).toBe('floorAndWalls');
  });

  it('round-trips tag <-> ordinal, and rejects non-cutout tags', () => {
    expect(cutoutColorTag(3)).toBe(CUTOUT_COLOR_TAG_BASE + 3);
    expect(cutoutOrdinalFromTag(cutoutColorTag(3))).toBe(3);
    expect(cutoutOrdinalFromTag(9)).toBeNull();
    expect(cutoutOrdinalFromTag(255)).toBeNull();
  });

  describe('resolveCutoutTriColor', () => {
    const units = enumerateCutoutColorUnits([
      cut({ id: 'a', color: '#ef4444', colorScope: 'floorAndWalls' }),
      cut({ id: 'b', color: '#3b82f6', colorScope: 'floor' }),
      cut({ id: 'c' }), // uncolored
    ]);

    it('paints both floor and wall for floorAndWalls scope', () => {
      expect(resolveCutoutTriColor(cutoutColorTag(0), 1, units)).toBe('#ef4444');
      expect(resolveCutoutTriColor(cutoutColorTag(0), 0, units)).toBe('#ef4444');
    });

    it('paints only the floor for floor scope', () => {
      expect(resolveCutoutTriColor(cutoutColorTag(1), 0.95, units)).toBe('#3b82f6');
      expect(resolveCutoutTriColor(cutoutColorTag(1), 0.1, units)).toBeNull();
    });

    it('returns null for uncolored units and non-cutout tags', () => {
      expect(resolveCutoutTriColor(cutoutColorTag(2), 1, units)).toBeNull();
      expect(resolveCutoutTriColor(9, 1, units)).toBeNull();
    });
  });

  it('anyCutoutColored reflects whether a color is set', () => {
    expect(anyCutoutColored([cut({ id: 'a' })])).toBe(false);
    expect(anyCutoutColored([cut({ id: 'a' }), cut({ id: 'b', color: '#fff' })])).toBe(true);
  });
});
