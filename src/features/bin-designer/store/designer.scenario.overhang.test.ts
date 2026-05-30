import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';

describe('DesignerStore - overhang actions', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('updates a single side, preserving the others', () => {
    const { updateOverhang } = useDesignerStore.getState();
    updateOverhang({ right: 5 });

    const { overhang } = useDesignerStore.getState().params;
    expect(overhang).toEqual({ left: 0, right: 5, front: 0, back: 0 });
  });

  it('merges successive partial updates', () => {
    const { updateOverhang } = useDesignerStore.getState();
    updateOverhang({ left: 2 });
    updateOverhang({ back: 3 });

    const { overhang } = useDesignerStore.getState().params;
    expect(overhang).toEqual({ left: 2, right: 0, front: 0, back: 3 });
  });

  it('clamps negative values to zero (outward-only)', () => {
    const { updateOverhang } = useDesignerStore.getState();
    updateOverhang({ left: -10, front: -1 });

    const { overhang } = useDesignerStore.getState().params;
    expect(overhang?.left).toBe(0);
    expect(overhang?.front).toBe(0);
  });

  it('pushes a history entry so the change is undoable', () => {
    const { updateOverhang, undo } = useDesignerStore.getState();
    updateOverhang({ right: 7 });
    expect(useDesignerStore.getState().params.overhang?.right).toBe(7);

    undo();
    expect(useDesignerStore.getState().params.overhang?.right ?? 0).toBe(0);
  });
});
