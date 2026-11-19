import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { Cutout } from '@/features/bin-designer/types';
import { withResolvedCutoutDepths } from '@/shared/utils/cutoutDepth';
import { deriveBodyType } from './bodyType';
import type { BodyType } from './bodyType';
import { useBodyTypeSwitch } from './useBodyTypeSwitch';

const THROUGH_POCKET: Cutout = {
  id: 'p1',
  shape: 'rectangle',
  x: 10,
  y: 10,
  width: 20,
  depth: 15,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  depthMode: 'through',
};

describe('useBodyTypeSwitch', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useDesignerStore.getState().addCutout(THROUGH_POCKET);
  });

  // Base only takes the pocket away; the next body gives it back at that
  // body's own fill depth.
  it.each<BodyType>(['flat', 'nesting', 'tray'])(
    'gives a through pocket back on %s after Base only',
    (next) => {
      const { result } = renderHook(() => useBodyTypeSwitch());
      act(() => result.current('tile'));
      expect(useDesignerStore.getState().params.cutouts).toEqual([]);

      act(() => result.current(next));
      const { params } = useDesignerStore.getState();
      expect(deriveBodyType(params.base)).toBe(next);
      expect(params.cutouts.map((c) => c.depthMode)).toEqual(['through']);
      expect(withResolvedCutoutDepths(params)).toBe(params);
    }
  );
});
