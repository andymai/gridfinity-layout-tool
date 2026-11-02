import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { Cutout } from '@/features/bin-designer/types';

function pocket(overrides: Partial<Cutout> = {}): Cutout {
  return {
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
    ...overrides,
  };
}

function cutout(id = 'p1'): Cutout {
  const found = useDesignerStore.getState().params.cutouts.find((c) => c.id === id);
  if (!found) throw new Error(`no cutout ${id}`);
  return found;
}

// The default bin: 3u on a 4.75mm socket, 16.25mm of fill. A floor 8mm above
// the underside leaves a 13mm pocket.
describe('DesignerStore - cutout depth modes', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('derives a floored depth as soon as the cutout lands', () => {
    useDesignerStore.getState().addCutout(pocket({ depthMode: 'floor', floorMm: 8 }));
    expect(cutout().cutDepth).toBe(13);
  });

  it('holds a floored pocket to its floor and a fixed one to its depth as the bin grows', () => {
    const { addCutout, setParam } = useDesignerStore.getState();
    addCutout(pocket({ depthMode: 'floor', floorMm: 8 }));
    addCutout(pocket({ id: 'p2', cutDepth: 6 }));
    setParam('height', 5);
    expect(cutout('p1').cutDepth).toBe(27);
    expect(cutout('p2').cutDepth).toBe(6);
  });

  it('cuts a through pocket through all the fill', () => {
    useDesignerStore.getState().addCutout(pocket({ depthMode: 'through' }));
    expect(cutout().cutDepth).toBe(16.25);
  });

  it('makes a pocket fixed when a depth is typed for it', () => {
    const { addCutout, updateCutout } = useDesignerStore.getState();
    addCutout(pocket({ depthMode: 'floor', floorMm: 8 }));
    updateCutout('p1', { cutDepth: 6 });
    expect(cutout()).not.toHaveProperty('depthMode');
    expect(cutout()).not.toHaveProperty('floorMm');
    expect(cutout().cutDepth).toBe(6);
  });

  it('keeps the current depth when switched back to fixed', () => {
    const { addCutout, updateCutout } = useDesignerStore.getState();
    addCutout(pocket({ depthMode: 'floor', floorMm: 8 }));
    updateCutout('p1', { depthMode: undefined });
    expect(cutout()).not.toHaveProperty('depthMode');
    expect(cutout().cutDepth).toBe(13);
  });

  it('makes every pocket in a batch fixed when one depth is typed for all', () => {
    const { addCutout, updateCutoutsBatch } = useDesignerStore.getState();
    addCutout(pocket({ depthMode: 'through' }));
    addCutout(pocket({ id: 'p2', depthMode: 'floor' }));
    updateCutoutsBatch(
      new Map([
        ['p1', { cutDepth: 4 }],
        ['p2', { cutDepth: 4 }],
      ])
    );
    expect([cutout('p1'), cutout('p2')].map((c) => [c.depthMode, c.cutDepth])).toEqual([
      [undefined, 4],
      [undefined, 4],
    ]);
  });

  it('leaves the mode alone when another field changes', () => {
    const { addCutout, updateCutout } = useDesignerStore.getState();
    addCutout(pocket({ depthMode: 'floor', floorMm: 8 }));
    updateCutout('p1', { rotation: 45 });
    expect(cutout().depthMode).toBe('floor');
    expect(cutout().floorMm).toBe(8);
  });

  it('restores the mode on undo', () => {
    const { addCutout, updateCutout } = useDesignerStore.getState();
    addCutout(pocket({ depthMode: 'floor', floorMm: 8 }));
    updateCutout('p1', { cutDepth: 6 });
    useDesignerStore.getState().undo();
    expect(cutout().depthMode).toBe('floor');
    expect(cutout().cutDepth).toBe(13);
  });

  describe('thickness prompt queue', () => {
    it('queues each id once and clears the ones answered', () => {
      const { queueDepthPrompt, clearDepthPrompt } = useDesignerStore.getState();
      queueDepthPrompt(['a', 'b']);
      queueDepthPrompt(['b', 'c']);
      expect(useDesignerStore.getState().ui.depthPromptIds).toEqual(['a', 'b', 'c']);
      clearDepthPrompt(['a', 'c']);
      expect(useDesignerStore.getState().ui.depthPromptIds).toEqual(['b']);
      clearDepthPrompt();
      expect(useDesignerStore.getState().ui.depthPromptIds).toEqual([]);
    });

    it('keeps one entry per id even when an import repeats one', () => {
      useDesignerStore.getState().queueDepthPrompt(['a', 'a', 'b']);
      expect(useDesignerStore.getState().ui.depthPromptIds).toEqual(['a', 'b']);
    });

    it('starts empty in a new or freshly loaded design', () => {
      const { queueDepthPrompt, newDesign } = useDesignerStore.getState();
      queueDepthPrompt(['a']);
      newDesign();
      expect(useDesignerStore.getState().ui.depthPromptIds).toEqual([]);
      queueDepthPrompt(['b']);
      useDesignerStore.getState().loadDesign({
        id: 'd',
        name: 'Saved',
        params: useDesignerStore.getState().params,
        thumbnail: null,
        createdAt: 0,
        updatedAt: 0,
      } as unknown as Parameters<ReturnType<typeof useDesignerStore.getState>['loadDesign']>[0]);
      expect(useDesignerStore.getState().ui.depthPromptIds).toEqual([]);
    });

    it('stays out of undo', () => {
      const { addCutout, queueDepthPrompt } = useDesignerStore.getState();
      addCutout(pocket());
      queueDepthPrompt(['p1']);
      useDesignerStore.getState().undo();
      expect(useDesignerStore.getState().ui.depthPromptIds).toEqual(['p1']);
      expect(useDesignerStore.getState().params.cutouts).toEqual([]);
    });
  });
});
