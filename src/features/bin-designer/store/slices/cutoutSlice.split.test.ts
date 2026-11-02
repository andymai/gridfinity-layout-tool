import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { Cutout, CutoutSplit } from '@/features/bin-designer/types';

function cut(overrides: Partial<Cutout> = {}): Cutout {
  return {
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
    ...overrides,
  };
}

const SPLIT: CutoutSplit = { a: { x: 10, y: -10 }, b: { x: 10, y: 10 }, cutDepth: 5 };

const pocket = (): Cutout | undefined =>
  useDesignerStore.getState().params.cutouts.find((c) => c.id === 'p');

describe('cutout splits in the store', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useDesignerStore.getState().addCutout(cut());
  });

  it('sets and removes a split, one undo step each', () => {
    const { setCutoutSplit, undo } = useDesignerStore.getState();
    setCutoutSplit('p', SPLIT);
    expect(pocket()?.split).toEqual(SPLIT);
    setCutoutSplit('p', null);
    expect(Object.keys(pocket() ?? {})).not.toContain('split');
    undo();
    expect(pocket()?.split).toEqual(SPLIT);
  });

  it('leaves history alone when removing a split that is not there', () => {
    const before = useDesignerStore.getState().history.past.length;
    useDesignerStore.getState().setCutoutSplit('p', null);
    expect(useDesignerStore.getState().history.past.length).toBe(before);
  });

  it('carries the line through a resize so it divides the pocket where it did', () => {
    const { setCutoutSplit, updateCutout } = useDesignerStore.getState();
    setCutoutSplit('p', SPLIT);
    updateCutout('p', { width: 120, depth: 10 });
    expect(pocket()?.split).toEqual({ ...SPLIT, a: { x: 20, y: -5 }, b: { x: 20, y: 5 } });
  });

  it('keeps the line through a move or a turn', () => {
    const { setCutoutSplit, updateCutout } = useDesignerStore.getState();
    setCutoutSplit('p', SPLIT);
    updateCutout('p', { x: 5, y: 5, rotation: 30 });
    expect(pocket()?.split).toEqual(SPLIT);
  });

  it('drops the split when the pocket becomes a shape that cannot be split', () => {
    const { setCutoutSplit, updateCutout } = useDesignerStore.getState();
    setCutoutSplit('p', SPLIT);
    updateCutout('p', { shape: 'text' });
    expect(Object.keys(pocket() ?? {})).not.toContain('split');
  });

  it('keeps a paused split through a lean, so undoing the lean brings it back', () => {
    const { setCutoutSplit, updateCutout } = useDesignerStore.getState();
    setCutoutSplit('p', SPLIT);
    updateCutout('p', { leanDeg: 10 });
    expect(pocket()?.split).toEqual(SPLIT);
  });

  it('holds side B to its floor as the bin changes height', () => {
    const { setCutoutSplit, setParam } = useDesignerStore.getState();
    setCutoutSplit('p', { ...SPLIT, depthMode: 'floor', floorMm: 2 });
    const before = pocket()?.split?.cutDepth ?? 0;
    setParam('height', useDesignerStore.getState().params.height + 1);
    expect((pocket()?.split?.cutDepth ?? 0) - before).toBeCloseTo(7, 6);
  });
});
