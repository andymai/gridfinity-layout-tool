import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { Cutout } from '@/features/bin-designer/types';

const shape = (id: string, x: number, parentGroups?: string[]): Cutout => ({
  id,
  shape: 'rectangle',
  x,
  y: 0,
  width: 10,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...(parentGroups ? { parentGroups } : {}),
});

describe('replaceCutouts', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('swaps shapes in one undo step, reusing an id, the new ones on top', () => {
    const store = useDesignerStore.getState();
    store.addCutout(shape('a', 0));
    store.addCutout(shape('b', 20));
    const depth = useDesignerStore.getState().history.past.length;

    store.replaceCutouts(['a'], [shape('a', 50), shape('c', 70)]);
    const { params, history } = useDesignerStore.getState();
    expect(params.cutouts.map((c) => c.id)).toEqual(['b', 'a', 'c']);
    expect(params.cutouts.find((c) => c.id === 'a')?.x).toBe(50);
    const z = params.cutouts.map((c) => c.zIndex ?? 0);
    expect(z[1]).toBeGreaterThan(z[0]);
    expect(z[2]).toBeGreaterThan(z[1]);
    expect(history.past.length).toBe(depth + 1);

    useDesignerStore.getState().undo();
    expect(useDesignerStore.getState().params.cutouts.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('keeps the metadata of a container that only the swapped shapes use', () => {
    const store = useDesignerStore.getState();
    store.addCutout(shape('a', 0, ['box']));
    store.addCutout(shape('b', 20, ['box']));
    store.setCutoutGroupName('box', 'Drawer A');
    store.replaceCutouts(['a', 'b'], [shape('c', 0, ['box']), shape('d', 20, ['box'])]);
    expect(useDesignerStore.getState().params.cutoutGroupNames?.box).toBe('Drawer A');
  });
});
