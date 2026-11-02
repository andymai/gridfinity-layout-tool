import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { Cutout } from '@/features/bin-designer/types';
import { MAX_PARENT_GROUPS } from '@/features/bin-designer/types';

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

const FINGER = cut({
  id: 'f',
  shape: 'slot',
  x: 40,
  y: 20,
  width: 20,
  depth: 40,
  cutDepth: 9,
  finger: { bottom: 'curved' },
});

const byId = (id: string): Cutout | undefined =>
  useDesignerStore.getState().params.cutouts.find((c) => c.id === id);

describe('addFingerAccess', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('binds the pocket and its finger cut in a new container', () => {
    const { addCutout, addFingerAccess } = useDesignerStore.getState();
    addCutout(cut());
    expect(addFingerAccess('p', FINGER)).toBe(true);

    const pocket = byId('p');
    const finger = byId('f');
    expect(pocket?.parentGroups).toHaveLength(1);
    expect(finger?.parentGroups).toEqual(pocket?.parentGroups);
    expect(finger?.groupId).toBeNull();
    expect(pocket?.groupId).toBeNull();
  });

  it('is one undo step', () => {
    const { addCutout, addFingerAccess } = useDesignerStore.getState();
    addCutout(cut());
    const before = useDesignerStore.getState().params.cutouts;
    addFingerAccess('p', FINGER);
    useDesignerStore.getState().undo();
    expect(useDesignerStore.getState().params.cutouts).toEqual(before);
  });

  it('wraps a boolean group whole, leaving its op alone', () => {
    const { addCutout, groupCutouts, addFingerAccess } = useDesignerStore.getState();
    addCutout(cut());
    addCutout(cut({ id: 'q', x: 30 }));
    groupCutouts(['p', 'q'], 'subtract');
    const op = byId('p')?.groupId;

    addFingerAccess('p', FINGER);
    const [container] = byId('p')?.parentGroups ?? [];
    expect(container).toBeDefined();
    for (const id of ['p', 'q']) {
      expect(byId(id)).toMatchObject({ groupId: op, parentGroups: [container] });
    }
    expect(byId('f')).toMatchObject({ groupId: null, parentGroups: [container] });
  });

  it('nests the binding inside the containers the pocket is already in', () => {
    const { addCutout, addFingerAccess } = useDesignerStore.getState();
    addCutout(cut({ parentGroups: ['outer'] }));
    addFingerAccess('p', FINGER);
    const chain = byId('p')?.parentGroups ?? [];
    expect(chain).toHaveLength(2);
    expect(chain[0]).toBe('outer');
    expect(byId('f')?.parentGroups).toEqual(chain);
  });

  it('adds the cut loose beside a pocket already as deep as a chain goes', () => {
    const deep = Array.from({ length: MAX_PARENT_GROUPS }, (_, i) => `g${i}`);
    const { addCutout, addFingerAccess } = useDesignerStore.getState();
    addCutout(cut({ parentGroups: deep }));
    expect(addFingerAccess('p', FINGER)).toBe(true);
    expect(byId('p')?.parentGroups).toEqual(deep);
    expect(byId('f')?.parentGroups).toEqual(deep);
  });

  it('adds nothing for a pocket that is not there', () => {
    expect(useDesignerStore.getState().addFingerAccess('missing', FINGER)).toBe(false);
    expect(byId('f')).toBeUndefined();
  });
});

describe('finger cuts under ordinary updates', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('drops the role when the cut stops being a slot or a round', () => {
    const { addCutout, updateCutout } = useDesignerStore.getState();
    addCutout(FINGER);
    updateCutout('f', { shape: 'circle', width: 20, depth: 20 });
    expect(byId('f')?.finger).toEqual({ bottom: 'curved' });
    updateCutout('f', { shape: 'rectangle' });
    expect(byId('f') && 'finger' in (byId('f') as Cutout)).toBe(false);
  });

  it('leaves no key behind when the role is switched off', () => {
    const { addCutout, updateCutout } = useDesignerStore.getState();
    addCutout(FINGER);
    updateCutout('f', { finger: undefined });
    expect(Object.keys(byId('f') ?? {})).not.toContain('finger');
  });
});
