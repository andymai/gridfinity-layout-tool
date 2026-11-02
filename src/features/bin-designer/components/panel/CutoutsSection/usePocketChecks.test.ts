import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { useCutoutSelection } from '@/features/bin-designer/store';
import type { Cutout } from '@/features/bin-designer/types';
import { usePocketChecks } from './usePocketChecks';

const PARAMS = {
  ...DEFAULT_BIN_PARAMS,
  style: 'solid' as const,
  base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' as const, solid: true, stackingLip: false },
};
const BOARD = { width: 80, depth: 80 };

const pocket = (id: string, overrides: Partial<Cutout> = {}): Cutout => ({
  id,
  shape: 'rectangle',
  x: 20,
  y: 20,
  width: 20,
  depth: 20,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...overrides,
});

describe('usePocketChecks', () => {
  beforeEach(() => {
    useCutoutSelection.getState().setGroupContext([]);
  });

  it('selects the shapes an issue names, inside the container they share', () => {
    const inside = { parentGroups: ['box'] };
    const cutouts = [pocket('a', inside), pocket('b', { ...inside, x: 41 })];
    const selectIds = vi.fn();
    const { result } = renderHook(() =>
      usePocketChecks(cutouts, PARAMS, BOARD, true, selectIds, vi.fn())
    );
    const issue = result.current.view?.issues[0];
    expect(issue).toMatchObject({ kind: 'thin', ids: ['a', 'b'] });
    expect([...result.current.issueInstanceIds].sort()).toEqual(['a', 'b']);
    act(() => result.current.view?.onSelect(issue?.ids ?? []));
    expect(useCutoutSelection.getState().groupContext).toEqual(['box']);
    expect(selectIds).toHaveBeenCalledWith(['a', 'b'], false);
  });

  it('applies a fix to the cutout it is for', () => {
    const onUpdate = vi.fn();
    const deep = pocket('a', { cutDepth: 20.5 });
    const { result } = renderHook(() =>
      usePocketChecks([deep], PARAMS, BOARD, true, vi.fn(), onUpdate)
    );
    const floor = result.current.view?.issues.find((i) => i.kind === 'floor');
    expect(floor).toBeDefined();
    act(() => floor && result.current.view?.onFix(floor));
    expect(onUpdate).toHaveBeenCalledWith('a', floor?.fix);
  });

  it('checks nothing when switched off', () => {
    const { result } = renderHook(() =>
      usePocketChecks([pocket('a'), pocket('b', { x: 41 })], PARAMS, BOARD, false, vi.fn(), vi.fn())
    );
    expect(result.current.view).toBeUndefined();
    expect(result.current.issueInstanceIds.size).toBe(0);
  });
});
