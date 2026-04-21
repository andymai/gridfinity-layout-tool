import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { SavedDesign } from '@/features/bin-designer/types';
import type { CellMask } from '@/shared/utils/cellMask';
import type { DesignId } from '@/core/types';

function makeSaved(overrides: Partial<SavedDesign['params']> = {}): SavedDesign {
  return {
    id: 'test-design' as DesignId,
    name: 'Test',
    params: { ...DEFAULT_BIN_PARAMS, ...overrides },
    thumbnail: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    exportFileNameConfig: null,
  };
}

/** Build a mask from a 2D boolean array (row 0 = bottom, written visually top-first). */
function buildMask(rows: (0 | 1)[][]): CellMask {
  const bottomFirst = rows.slice().reverse();
  const cols = bottomFirst[0]?.length ?? 0;
  return { cols, rows: bottomFirst.length, cells: bottomFirst.flat() };
}

describe('persistenceSlice.loadDesign — UI derivation from params', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('enables halfBinMode when loading a design with fractional dimensions', () => {
    const { loadDesign } = useDesignerStore.getState();
    loadDesign(makeSaved({ width: 1.5, depth: 1.5 }));
    expect(useDesignerStore.getState().ui.halfBinMode).toBe(true);
  });

  it('enables halfBinMode when the cellMask has mixed half-bin detail', () => {
    // 2×2 bin (4×4 mask) with one half-cell cleared — mixed 1u block.
    const cells = new Array<0 | 1>(16).fill(1);
    cells[3] = 0;
    const cellMask = { cols: 4, rows: 4, cells };
    const { loadDesign } = useDesignerStore.getState();
    loadDesign(makeSaved({ width: 2, depth: 2, cellMask }));
    expect(useDesignerStore.getState().ui.halfBinMode).toBe(true);
  });

  it('leaves halfBinMode off for a 1u-aligned preset mask', () => {
    // 3×3 L preset: cleared corner aligns to 1u, no half-bin detail.
    const cellMask = buildMask([
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 0, 0],
      [1, 1, 1, 1, 0, 0],
    ]);
    const { loadDesign } = useDesignerStore.getState();
    loadDesign(makeSaved({ width: 3, depth: 3, cellMask }));
    expect(useDesignerStore.getState().ui.halfBinMode).toBe(false);
  });

  it('opens the shape editor when loading a custom-masked design', () => {
    const cellMask = buildMask([
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 0],
    ]);
    const { loadDesign } = useDesignerStore.getState();
    loadDesign(makeSaved({ width: 2, depth: 2, cellMask }));
    expect(useDesignerStore.getState().ui.shapeEditorOpen).toBe(true);
  });

  it('leaves the shape editor closed for a rectangular design', () => {
    const { loadDesign } = useDesignerStore.getState();
    loadDesign(makeSaved({ width: 2, depth: 2 }));
    expect(useDesignerStore.getState().ui.shapeEditorOpen).toBe(false);
  });

  it('normalises toggles off when switching from a half-bin design to a rectangular one', () => {
    useDesignerStore.setState((s) => ({
      ui: { ...s.ui, halfBinMode: true, shapeEditorOpen: true },
    }));
    const { loadDesign } = useDesignerStore.getState();
    loadDesign(makeSaved({ width: 2, depth: 2 }));
    expect(useDesignerStore.getState().ui.halfBinMode).toBe(false);
    expect(useDesignerStore.getState().ui.shapeEditorOpen).toBe(false);
  });

  it('newDesign resets halfBinMode and shapeEditorOpen', () => {
    useDesignerStore.setState((s) => ({
      ui: { ...s.ui, halfBinMode: true, shapeEditorOpen: true },
    }));
    useDesignerStore.getState().newDesign();
    expect(useDesignerStore.getState().ui.halfBinMode).toBe(false);
    expect(useDesignerStore.getState().ui.shapeEditorOpen).toBe(false);
  });

  it('drops a structurally-invalid cellMask on load (defends against crafted shares)', () => {
    // Mask with a disconnected component — validateMask rejects this.
    // Two isolated cells with no 4-connected path between them.
    const cells: (0 | 1)[] = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
    const { loadDesign } = useDesignerStore.getState();
    loadDesign(makeSaved({ width: 2, depth: 2, cellMask: { cols: 4, rows: 4, cells } }));
    // Bad mask must be dropped — not handed to the generator.
    expect(useDesignerStore.getState().params.cellMask).toBeUndefined();
    expect(useDesignerStore.getState().ui.shapeEditorOpen).toBe(false);
  });

  it('keeps a structurally-valid custom mask on load', () => {
    const cells: (0 | 1)[] = [1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    const { loadDesign } = useDesignerStore.getState();
    loadDesign(makeSaved({ width: 2, depth: 2, cellMask: { cols: 4, rows: 4, cells } }));
    expect(useDesignerStore.getState().params.cellMask).toBeDefined();
    expect(useDesignerStore.getState().ui.shapeEditorOpen).toBe(true);
  });
});

describe('history restore normalises UI toggles', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 2, depth: 2 },
    });
  });

  it('undoing across a custom-shape paint closes the shape editor', () => {
    const { setCellMask, undo } = useDesignerStore.getState();
    // Paint an L mask (creates a history entry with params = rectangle).
    setCellMask({
      cols: 4,
      rows: 4,
      cells: [1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] as (0 | 1)[],
    });
    expect(useDesignerStore.getState().ui.shapeEditorOpen).toBe(false); // not toggled by setCellMask
    useDesignerStore.setState((s) => ({ ui: { ...s.ui, shapeEditorOpen: true } }));
    undo();
    expect(useDesignerStore.getState().params.cellMask).toBeUndefined();
    // Restored params have no mask → editor should close.
    expect(useDesignerStore.getState().ui.shapeEditorOpen).toBe(false);
  });

  it('undoing across a fractional dimension change turns halfBinMode off', () => {
    const { setParam, undo } = useDesignerStore.getState();
    // Go from 2×2 (integer) to 1.5×2 (fractional).
    useDesignerStore.setState((s) => ({ ui: { ...s.ui, halfBinMode: true } }));
    setParam('width', 1.5);
    expect(useDesignerStore.getState().params.width).toBe(1.5);
    expect(useDesignerStore.getState().ui.halfBinMode).toBe(true);
    undo();
    expect(useDesignerStore.getState().params.width).toBe(2);
    // Restored params are integer → halfBinMode should be off.
    expect(useDesignerStore.getState().ui.halfBinMode).toBe(false);
  });
});
