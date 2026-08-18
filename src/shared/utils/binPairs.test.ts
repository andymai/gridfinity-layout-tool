import { describe, it, expect } from 'vitest';
import type { Bin, BinId } from '@/core/types';
import { binId, layerId, categoryId, gridUnits, heightUnits } from '@/core/types';
import { expandPairIds, pairPartner, dropOrphanedPairs } from './binPairs';

function bin(id: string, extra: Partial<Bin> = {}): Bin {
  return {
    id: binId(id),
    layerId: layerId('layer-1'),
    x: gridUnits(0),
    y: gridUnits(0),
    width: gridUnits(1),
    depth: gridUnits(1),
    height: heightUnits(3),
    category: categoryId(''),
    label: '',
    notes: '',
    ...extra,
  };
}

const PAIRED = [
  bin('block', { pairId: 'p1', pairRole: 'block' }),
  bin('rest', { pairId: 'p1', pairRole: 'rest' }),
  bin('loner'),
];

describe('pairPartner', () => {
  it('finds the other half and nothing else', () => {
    expect(pairPartner(PAIRED[0], PAIRED)?.id).toBe(binId('rest'));
    expect(pairPartner(PAIRED[1], PAIRED)?.id).toBe(binId('block'));
    expect(pairPartner(PAIRED[2], PAIRED)).toBeUndefined();
  });
});

describe('expandPairIds', () => {
  it('pulls the partner into the set', () => {
    const out = expandPairIds(new Set<BinId>([binId('block')]), PAIRED);
    expect([...out].sort()).toEqual([binId('block'), binId('rest')].sort());
  });

  it('returns the same set instance when nothing was added', () => {
    const ids = new Set<BinId>([binId('loner')]);
    expect(expandPairIds(ids, PAIRED)).toBe(ids);
    const whole = new Set<BinId>([binId('block'), binId('rest')]);
    expect(expandPairIds(whole, PAIRED)).toBe(whole);
  });
});

describe('dropOrphanedPairs', () => {
  it('strips pairing from a half whose partner is gone', () => {
    const bins = [PAIRED[0], PAIRED[2]];
    const out = dropOrphanedPairs(bins);
    expect(out.find((b) => b.id === binId('block'))?.pairId).toBeUndefined();
    expect(out.find((b) => b.id === binId('block'))?.pairRole).toBeUndefined();
  });

  it('leaves whole pairs alone (and returns the same array)', () => {
    expect(dropOrphanedPairs(PAIRED)).toBe(PAIRED);
  });

  it('unpairs a crowd sharing one pairId (double share import)', () => {
    const crowd = [...PAIRED, bin('extra', { pairId: 'p1', pairRole: 'rest' })];
    const out = dropOrphanedPairs(crowd);
    expect(out.every((b) => b.pairId === undefined)).toBe(true);
  });
});
