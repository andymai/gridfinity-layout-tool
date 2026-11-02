import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCutoutSelection, useDesignerStore } from '@/features/bin-designer/store';
import type { Cutout } from '@/features/bin-designer/types';
import { useAddFingerAccess } from './useAddFingerAccess';

const POCKET: Cutout = {
  id: 'p',
  shape: 'rectangle',
  x: 20,
  y: 40,
  width: 60,
  depth: 20,
  cutDepth: 10,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
};
const BOARD = { width: 120, depth: 120 };

describe('useAddFingerAccess', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useCutoutSelection.getState().setGroupContext([]);
    useDesignerStore.getState().addCutout(POCKET);
  });

  it('adds the cut and selects it inside the group that binds it to the pocket', () => {
    const selectIds = vi.fn();
    const { result } = renderHook(() => useAddFingerAccess([POCKET], BOARD, 30, selectIds));
    act(() => result.current('p'));

    const cutouts = useDesignerStore.getState().params.cutouts;
    const finger = cutouts.find((c) => c.finger !== undefined);
    expect(finger).toBeDefined();
    expect(selectIds).toHaveBeenCalledWith([finger?.id], false);
    expect(useCutoutSelection.getState().groupContext).toEqual(finger?.parentGroups);
  });

  it('does nothing for a pocket that cannot take one', () => {
    const selectIds = vi.fn();
    const text = { ...POCKET, id: 't', shape: 'text' as const };
    const { result } = renderHook(() => useAddFingerAccess([text], BOARD, 30, selectIds));
    act(() => result.current('t'));
    expect(useDesignerStore.getState().params.cutouts).toHaveLength(1);
    expect(selectIds).not.toHaveBeenCalled();
  });
});
