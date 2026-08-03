import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import { canGroupSelection } from './pathfinderHelpers';

const cutout = (overrides: Partial<Cutout> = {}): Cutout => ({
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
  ...overrides,
});

describe('canGroupSelection', () => {
  it('is false for fewer than two cutouts', () => {
    const cs = [cutout({ id: 'a' })];
    expect(canGroupSelection(['a'], cs)).toBe(false);
    expect(canGroupSelection([], cs)).toBe(false);
  });

  it('is true for two loose cutouts', () => {
    const cs = [cutout({ id: 'a' }), cutout({ id: 'b' })];
    expect(canGroupSelection(['a', 'b'], cs)).toBe(true);
  });

  it('is false when the selection is one whole group', () => {
    const cs = [cutout({ id: 'a', groupId: 'g1' }), cutout({ id: 'b', groupId: 'g1' })];
    expect(canGroupSelection(['a', 'b'], cs)).toBe(false);
  });

  // resolveActiveOp returns null here (the group has an unselected member), so
  // gating on it showed Group for a click that only spends an undo slot.
  it('is false for a partial selection of one group', () => {
    const cs = [
      cutout({ id: 'a', groupId: 'g1' }),
      cutout({ id: 'b', groupId: 'g1' }),
      cutout({ id: 'c', groupId: 'g1' }),
    ];
    expect(canGroupSelection(['a', 'b'], cs)).toBe(false);
  });

  it('is true for a loose cutout alongside a group — that folds it in', () => {
    const cs = [
      cutout({ id: 'a', groupId: 'g1' }),
      cutout({ id: 'b', groupId: 'g1' }),
      cutout({ id: 'c' }),
    ];
    expect(canGroupSelection(['a', 'b', 'c'], cs)).toBe(true);
  });

  it('is true when the selection spans two groups', () => {
    const cs = [cutout({ id: 'a', groupId: 'g1' }), cutout({ id: 'b', groupId: 'g2' })];
    expect(canGroupSelection(['a', 'b'], cs)).toBe(true);
  });

  it('ignores selected ids that no longer exist', () => {
    const cs = [cutout({ id: 'a' })];
    expect(canGroupSelection(['a', 'ghost'], cs)).toBe(false);
  });
});
