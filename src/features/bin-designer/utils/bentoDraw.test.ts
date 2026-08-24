import { describe, it, expect } from 'vitest';
import {
  canPlaceRect,
  clearDrawnCompartments,
  drawCompartment,
  duplicateCompartment,
  findFreeRect,
  getCompartmentRect,
  getDrawnCompartmentIds,
  mergeCompartments,
  moveCompartment,
  placeFromStash,
  rectIndices,
  rectInBounds,
  removeCompartment,
  removeStashEntry,
  resizeCompartment,
  resizeGridPreservingCompartments,
  stashCompartment,
} from '@/features/bin-designer/utils/bentoDraw';
import {
  createUniformGrid,
  getCellsForCompartment,
  remapDrawnUnitCells,
  validateCompartmentGrid,
} from '@/features/bin-designer/utils/compartments';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import type { CompartmentConfig } from '@/features/bin-designer/types';

const grid = (cols = 4, rows = 3): CompartmentConfig => createUniformGrid(cols, rows, 1.2);

const draw = (config: CompartmentConfig, col: number, row: number, w: number, h: number) => {
  const result = drawCompartment(config, { col, row, w, h });
  expect(result).not.toBeNull();
  if (!result) throw new Error('unreachable');
  return result;
};

describe('bentoDraw', () => {
  describe('getDrawnCompartmentIds', () => {
    it('treats a fresh uniform grid as all background', () => {
      expect(getDrawnCompartmentIds(grid()).size).toBe(0);
    });

    it('marks multi-cell compartments as drawn', () => {
      const { config, id } = draw(grid(), 0, 0, 2, 2);
      expect(getDrawnCompartmentIds(config).has(id)).toBe(true);
    });

    it('marks labeled unit cells as drawn (legacy designs)', () => {
      const config: CompartmentConfig = { ...grid(), compartmentTexts: ['', 'screws'] };
      expect(getDrawnCompartmentIds(config).has(1)).toBe(true);
      expect(getDrawnCompartmentIds(config).has(0)).toBe(false);
    });

    it('marks plate-decorated unit cells as drawn', () => {
      const withPlate: CompartmentConfig = { ...grid(), labelPlateWidths: [null, 2] };
      expect(getDrawnCompartmentIds(withPlate).has(1)).toBe(true);
      const withIcon: CompartmentConfig = { ...grid(), labelIcons: ['bolt'] };
      expect(getDrawnCompartmentIds(withIcon).has(0)).toBe(true);
    });

    it('marks explicit drawnUnitCells and ignores stale IDs', () => {
      const config: CompartmentConfig = { ...grid(), drawnUnitCells: [3, 999] };
      const drawn = getDrawnCompartmentIds(config);
      expect(drawn.has(3)).toBe(true);
      expect(drawn.has(999)).toBe(false);
    });
  });

  describe('rect helpers', () => {
    it('rectIndices covers the rect row-major', () => {
      expect(rectIndices(4, { col: 1, row: 1, w: 2, h: 2 })).toEqual([5, 6, 9, 10]);
    });

    it('rectInBounds rejects zero-size and out-of-grid rects', () => {
      expect(rectInBounds(grid(), { col: 0, row: 0, w: 0, h: 1 })).toBe(false);
      expect(rectInBounds(grid(), { col: 3, row: 0, w: 2, h: 1 })).toBe(false);
      expect(rectInBounds(grid(), { col: -1, row: 0, w: 1, h: 1 })).toBe(false);
      expect(rectInBounds(grid(), { col: 0, row: 0, w: 4, h: 3 })).toBe(true);
    });

    it('canPlaceRect allows background, blocks drawn, honors ignoreId', () => {
      const { config, id } = draw(grid(), 0, 0, 2, 2);
      expect(canPlaceRect(config, { col: 2, row: 0, w: 2, h: 2 })).toBe(true);
      expect(canPlaceRect(config, { col: 1, row: 1, w: 2, h: 2 })).toBe(false);
      expect(canPlaceRect(config, { col: 1, row: 1, w: 2, h: 2 }, { ignoreId: id })).toBe(true);
    });
  });

  describe('drawCompartment', () => {
    it('merges the covered cells into one compartment', () => {
      const { config, id } = draw(grid(), 1, 0, 2, 2);
      const rect = getCompartmentRect(config, id);
      expect(rect).toEqual({ col: 1, row: 0, w: 2, h: 2 });
      expect(validateCompartmentGrid(config)).toEqual([]);
      expect(config.cells).toHaveLength(12);
    });

    it('returns null over a drawn compartment (blocked draw)', () => {
      const { config } = draw(grid(), 0, 0, 2, 2);
      expect(drawCompartment(config, { col: 1, row: 1, w: 2, h: 1 })).toBeNull();
    });

    it('marks a 1×1 draw via drawnUnitCells', () => {
      const { config, id } = draw(grid(), 2, 1, 1, 1);
      expect(config.drawnUnitCells).toEqual([id]);
      expect(getDrawnCompartmentIds(config).has(id)).toBe(true);
    });

    it('keeps existing drawn compartments and their labels intact', () => {
      const first = draw(grid(), 0, 0, 2, 1);
      const labeled: CompartmentConfig = {
        ...first.config,
        compartmentTexts: withTextAt(first.id, 'bolts'),
      };
      const second = draw(labeled, 2, 1, 2, 2);
      const survivingId = [...getDrawnCompartmentIds(second.config)].find(
        (candidate) => candidate !== second.id
      );
      expect(survivingId).toBeDefined();
      if (survivingId === undefined) throw new Error('unreachable');
      expect(second.config.compartmentTexts?.[survivingId]).toBe('bolts');
    });
  });

  describe('removeCompartment', () => {
    it('reverts cells to background and drops the label', () => {
      const { config, id } = draw(grid(), 0, 0, 2, 2);
      const labeled: CompartmentConfig = { ...config, compartmentTexts: withTextAt(id, 'nuts') };
      const removed = removeCompartment(labeled, id);
      expect(removed).not.toBeNull();
      if (!removed) throw new Error('unreachable');
      expect(getDrawnCompartmentIds(removed).size).toBe(0);
      expect(removed.compartmentTexts).toBeUndefined();
      expect(validateCompartmentGrid(removed)).toEqual([]);
    });

    it('removes a drawn 1×1 including its marker', () => {
      const { config, id } = draw(grid(), 1, 1, 1, 1);
      const removed = removeCompartment(config, id);
      expect(removed?.drawnUnitCells).toBeUndefined();
    });

    it('returns null for an unknown id', () => {
      expect(removeCompartment(grid(), 99)).toBeNull();
    });
  });

  describe('moveCompartment', () => {
    it('translates the footprint and carries the label', () => {
      const { config, id } = draw(grid(), 0, 0, 2, 2);
      const labeled: CompartmentConfig = { ...config, compartmentTexts: withTextAt(id, 'clips') };
      const moved = moveCompartment(labeled, id, 2, 1);
      expect(moved).not.toBeNull();
      if (!moved) throw new Error('unreachable');
      expect(getCompartmentRect(moved.config, moved.id)).toEqual({ col: 2, row: 1, w: 2, h: 2 });
      expect(moved.config.compartmentTexts?.[moved.id]).toBe('clips');
      expect(validateCompartmentGrid(moved.config)).toEqual([]);
    });

    it('allows moves overlapping its own previous footprint', () => {
      const { config, id } = draw(grid(), 0, 0, 2, 2);
      expect(moveCompartment(config, id, 1, 0)).not.toBeNull();
    });

    it('returns null when blocked by another drawn compartment', () => {
      const a = draw(grid(), 0, 0, 2, 2);
      const b = draw(a.config, 2, 0, 2, 2);
      const movedAId = [...getDrawnCompartmentIds(b.config)].find((c) => c !== b.id);
      expect(movedAId).toBeDefined();
      if (movedAId === undefined) throw new Error('unreachable');
      expect(moveCompartment(b.config, movedAId, 1, 0)).toBeNull();
    });

    it('returns null when leaving the grid', () => {
      const { config, id } = draw(grid(), 2, 1, 2, 2);
      expect(moveCompartment(config, id, 1, 0)).toBeNull();
    });

    it('keeps a moved 1×1 drawn', () => {
      const { config, id } = draw(grid(), 0, 0, 1, 1);
      const moved = moveCompartment(config, id, 3, 2);
      expect(moved).not.toBeNull();
      if (!moved) throw new Error('unreachable');
      expect(moved.config.drawnUnitCells).toEqual([moved.id]);
    });
  });

  describe('resizeCompartment', () => {
    it('grows into background grid', () => {
      const { config, id } = draw(grid(), 0, 0, 2, 1);
      const resized = resizeCompartment(config, id, { col: 0, row: 0, w: 3, h: 2 });
      expect(resized).not.toBeNull();
      if (!resized) throw new Error('unreachable');
      expect(getCompartmentRect(resized.config, resized.id)).toEqual({
        col: 0,
        row: 0,
        w: 3,
        h: 2,
      });
    });

    it('shrinking to 1×1 keeps the compartment drawn', () => {
      const { config, id } = draw(grid(), 0, 0, 2, 2);
      const resized = resizeCompartment(config, id, { col: 0, row: 0, w: 1, h: 1 });
      expect(resized).not.toBeNull();
      if (!resized) throw new Error('unreachable');
      expect(resized.config.drawnUnitCells).toEqual([resized.id]);
    });

    it('returns null when growing over a drawn neighbor', () => {
      const a = draw(grid(), 0, 0, 2, 2);
      const b = draw(a.config, 2, 0, 1, 2);
      const aId = [...getDrawnCompartmentIds(b.config)].find((c) => c !== b.id);
      if (aId === undefined) throw new Error('unreachable');
      expect(resizeCompartment(b.config, aId, { col: 0, row: 0, w: 3, h: 2 })).toBeNull();
    });
  });

  describe('duplicateCompartment', () => {
    it('stamps a copy with label and decoration', () => {
      const { config, id } = draw(grid(), 0, 0, 2, 1);
      const decorated: CompartmentConfig = {
        ...config,
        compartmentTexts: withTextAt(id, 'washers'),
        labelPlateWidths: withValueAt(id, 2),
        labelIcons: withValueAt(id, 'bolt'),
      };
      const dup = duplicateCompartment(decorated, id, { col: 2, row: 1, w: 2, h: 1 });
      expect(dup).not.toBeNull();
      if (!dup) throw new Error('unreachable');
      expect(dup.config.compartmentTexts?.[dup.id]).toBe('washers');
      expect(dup.config.labelPlateWidths?.[dup.id]).toBe(2);
      expect(dup.config.labelIcons?.[dup.id]).toBe('bolt');
      expect(getDrawnCompartmentIds(dup.config).size).toBe(2);
    });

    it('carries the colour and its scope like the other decorations', () => {
      const { config, id } = draw(grid(), 0, 0, 2, 1);
      const colored: CompartmentConfig = {
        ...config,
        compartmentColors: withValueAt(id, '#00ff00'),
        compartmentColorScopes: withValueAt(id, 'floor'),
      };
      const dup = duplicateCompartment(colored, id, { col: 2, row: 1, w: 2, h: 1 });
      if (!dup) throw new Error('unreachable');
      expect(dup.config.compartmentColors?.[dup.id]).toBe('#00ff00');
      expect(dup.config.compartmentColorScopes?.[dup.id]).toBe('floor');
      // The source keeps its own.
      const srcIds = [...getDrawnCompartmentIds(dup.config)].filter((i) => i !== dup.id);
      expect(dup.config.compartmentColors?.[srcIds[0]]).toBe('#00ff00');
    });

    it('rejects a size-mismatched or blocked target', () => {
      const { config, id } = draw(grid(), 0, 0, 2, 1);
      expect(duplicateCompartment(config, id, { col: 2, row: 1, w: 1, h: 1 })).toBeNull();
      expect(duplicateCompartment(config, id, { col: 1, row: 0, w: 2, h: 1 })).toBeNull();
    });
  });

  describe('stash', () => {
    it('stashCompartment moves footprint and label to the shelf', () => {
      const { config, id } = draw(grid(), 0, 0, 2, 2);
      const labeled: CompartmentConfig = { ...config, compartmentTexts: withTextAt(id, 'bits') };
      const stashed = stashCompartment(labeled, id);
      expect(stashed).not.toBeNull();
      if (!stashed) throw new Error('unreachable');
      expect(stashed.stash).toEqual([{ w: 2, h: 2, label: 'bits' }]);
      expect(getDrawnCompartmentIds(stashed).size).toBe(0);
    });

    it('stashCompartment omits empty labels from the entry', () => {
      const { config, id } = draw(grid(), 0, 0, 2, 1);
      const stashed = stashCompartment(config, id);
      expect(stashed?.stash).toEqual([{ w: 2, h: 1 }]);
    });

    it('stashCompartment refuses at capacity', () => {
      const full = Array.from({ length: DESIGNER_CONSTRAINTS.MAX_STASH_ENTRIES }, () => ({
        w: 1,
        h: 1,
      }));
      const { config, id } = draw({ ...grid(), stash: full }, 0, 0, 2, 2);
      expect(stashCompartment(config, id)).toBeNull();
    });

    it('placeFromStash draws the entry and restores its label', () => {
      const config: CompartmentConfig = { ...grid(), stash: [{ w: 2, h: 2, label: 'bits' }] };
      const placed = placeFromStash(config, 0, { col: 1, row: 0, w: 2, h: 2 });
      expect(placed).not.toBeNull();
      if (!placed) throw new Error('unreachable');
      expect(placed.config.stash).toBeUndefined();
      expect(placed.config.compartmentTexts?.[placed.id]).toBe('bits');
      expect(getCompartmentRect(placed.config, placed.id)).toEqual({ col: 1, row: 0, w: 2, h: 2 });
    });

    it('placeFromStash rejects size mismatch and blocked targets', () => {
      const config: CompartmentConfig = { ...grid(), stash: [{ w: 2, h: 2 }] };
      expect(placeFromStash(config, 0, { col: 0, row: 0, w: 1, h: 2 })).toBeNull();
      const { config: withDrawn } = draw(config, 0, 0, 2, 2);
      expect(placeFromStash(withDrawn, 0, { col: 1, row: 0, w: 2, h: 2 })).toBeNull();
    });

    it('removeStashEntry drops one entry and collapses to undefined', () => {
      const config: CompartmentConfig = { ...grid(), stash: [{ w: 1, h: 1 }] };
      expect(removeStashEntry(config, 0)?.stash).toBeUndefined();
      expect(removeStashEntry(config, 5)).toBeNull();
    });
  });

  describe('resizeGridPreservingCompartments', () => {
    it('keeps fitting compartments in place on grow', () => {
      const { config, id } = draw(grid(4, 3), 0, 0, 2, 2);
      const labeled: CompartmentConfig = { ...config, compartmentTexts: withTextAt(id, 'kept') };
      const result = resizeGridPreservingCompartments(labeled, 6, 5);
      expect(result.stashedCount).toBe(0);
      expect(result.droppedCount).toBe(0);
      expect(result.config.cols).toBe(6);
      expect(result.config.cells).toHaveLength(30);
      const drawnIds = [...getDrawnCompartmentIds(result.config)];
      expect(drawnIds).toHaveLength(1);
      expect(getCompartmentRect(result.config, drawnIds[0])).toEqual({
        col: 0,
        row: 0,
        w: 2,
        h: 2,
      });
      expect(result.config.compartmentTexts?.[drawnIds[0]]).toBe('kept');
      expect(validateCompartmentGrid(result.config)).toEqual([]);
    });

    it('stashes compartments that no longer fit, with labels', () => {
      const a = draw(grid(4, 3), 0, 0, 2, 2);
      const b = draw(a.config, 2, 0, 2, 1);
      const bLabeled: CompartmentConfig = {
        ...b.config,
        compartmentTexts: withTextAt(b.id, 'edge'),
      };
      const result = resizeGridPreservingCompartments(bLabeled, 2, 3);
      expect(result.stashedCount).toBe(1);
      expect(result.config.stash).toEqual([{ w: 2, h: 1, label: 'edge' }]);
      expect(getDrawnCompartmentIds(result.config).size).toBe(1);
    });

    it('drops past the stash cap and reports it', () => {
      const nearlyFull = Array.from({ length: DESIGNER_CONSTRAINTS.MAX_STASH_ENTRIES - 1 }, () => ({
        w: 1,
        h: 1,
      }));
      const a = draw({ ...grid(4, 3), stash: nearlyFull }, 3, 0, 1, 2);
      const b = draw(a.config, 2, 2, 2, 1);
      const result = resizeGridPreservingCompartments(b.config, 2, 2);
      expect(result.stashedCount).toBe(1);
      expect(result.droppedCount).toBe(1);
      expect(result.config.stash).toHaveLength(DESIGNER_CONSTRAINTS.MAX_STASH_ENTRIES);
    });
  });

  describe('findFreeRect', () => {
    it('finds the first background spot in reading order (back row first)', () => {
      expect(findFreeRect(grid(4, 3), 2, 1)).toEqual({ col: 0, row: 2, w: 2, h: 1 });
    });

    it('skips drawn compartments and returns null when nothing fits', () => {
      const { config } = draw(grid(2, 2), 0, 0, 2, 1);
      expect(findFreeRect(config, 2, 1)).toEqual({ col: 0, row: 1, w: 2, h: 1 });
      const { config: full } = draw(config, 0, 1, 2, 1);
      expect(findFreeRect(full, 1, 1)).toBeNull();
    });
  });

  describe('clearDrawnCompartments', () => {
    it('resets to background grid but keeps the stash', () => {
      const { config, id } = draw(grid(), 0, 0, 2, 2);
      const decorated: CompartmentConfig = {
        ...config,
        compartmentTexts: withTextAt(id, 'gone'),
        stash: [{ w: 1, h: 1, label: 'kept' }],
      };
      const cleared = clearDrawnCompartments(decorated);
      expect(getDrawnCompartmentIds(cleared).size).toBe(0);
      expect(cleared.compartmentTexts).toBeUndefined();
      expect(cleared.drawnUnitCells).toBeUndefined();
      expect(cleared.stash).toEqual([{ w: 1, h: 1, label: 'kept' }]);
      expect(cleared.cells).toEqual(grid().cells);
    });

    // Gotcha 6's grid-reset half: the rebuilt grid regenerates ids from
    // scratch, so a kept colour entry paints an unrelated background cell.
    it('drops colours with the compartments they painted', () => {
      const { config, id } = draw(grid(), 0, 0, 2, 2);
      const colored: CompartmentConfig = {
        ...config,
        compartmentColors: withValueAt(id, '#ff0000'),
        compartmentColorScopes: withValueAt(id, 'floorAndWalls'),
      };
      const cleared = clearDrawnCompartments(colored);
      expect(cleared.compartmentColors).toBeUndefined();
      expect(cleared.compartmentColorScopes).toBeUndefined();
    });
  });

  describe('compartment colours stay with their compartment', () => {
    it('follows a moved compartment to its new id', () => {
      const drawn = drawCompartment(grid(), { col: 0, row: 0, w: 2, h: 2 });
      if (!drawn) throw new Error('unreachable');
      const colored: CompartmentConfig = {
        ...drawn.config,
        compartmentColors: withValueAt(drawn.id, '#ff0000'),
        compartmentColorScopes: withValueAt(drawn.id, 'floorAndWalls'),
      };

      const moved = moveCompartment(colored, drawn.id, 2, 1);
      if (!moved) throw new Error('unreachable');

      expect(moved.config.compartmentColors?.[moved.id]).toBe('#ff0000');
      expect(moved.config.compartmentColorScopes?.[moved.id]).toBe('floorAndWalls');
    });

    it('does not leak a colour onto an unrelated compartment when ids renumber', () => {
      // Two drawn compartments; colour only the second. After removing the
      // FIRST, ids shift down — a colour left at its old index would land on
      // whatever compartment inherited that number (CLAUDE.md gotcha #6).
      const first = drawCompartment(grid(), { col: 0, row: 0, w: 1, h: 1 });
      if (!first) throw new Error('unreachable');
      const second = drawCompartment(first.config, { col: 3, row: 2, w: 1, h: 1 });
      if (!second) throw new Error('unreachable');
      const colored: CompartmentConfig = {
        ...second.config,
        compartmentColors: withValueAt(second.id, '#0000ff'),
      };

      const after = removeCompartment(colored, first.id);
      if (!after) throw new Error('unreachable');

      const stillColored = (after.compartmentColors ?? []).filter((c) => c !== null);
      expect(stillColored).toEqual(['#0000ff']);
    });

    it('drops the colour when its compartment is removed', () => {
      const drawn = drawCompartment(grid(), { col: 0, row: 0, w: 2, h: 2 });
      if (!drawn) throw new Error('unreachable');
      const colored: CompartmentConfig = {
        ...drawn.config,
        compartmentColors: withValueAt(drawn.id, '#ff0000'),
      };

      const after = removeCompartment(colored, drawn.id);
      if (!after) throw new Error('unreachable');

      expect(after.compartmentColors).toBeUndefined();
    });
  });

  describe('remapDrawnUnitCells (lockstep with normalizeIdsWithRemap)', () => {
    it('drops markers for vanished IDs and non-unit compartments', () => {
      const remap = new Map([
        [0, 0],
        [2, 1],
      ]);
      const newCells = [0, 0, 1, 2];
      expect(remapDrawnUnitCells([0, 2, 5], remap, newCells)).toEqual([1]);
    });

    it('returns undefined when nothing survives', () => {
      expect(remapDrawnUnitCells([7], new Map(), [0, 1])).toBeUndefined();
      expect(remapDrawnUnitCells(undefined, new Map(), [0])).toBeUndefined();
    });
  });
});

function withTextAt(id: number, text: string): string[] {
  const out = new Array<string>(id + 1).fill('');
  out[id] = text;
  return out;
}

function withValueAt<T>(id: number, value: T): (T | null)[] {
  const out = new Array<T | null>(id + 1).fill(null);
  out[id] = value;
  return out;
}

describe('bentoDraw with mergeBackground', () => {
  const mergedGrid = (cols = 3, rows = 3): CompartmentConfig => ({
    ...createUniformGrid(cols, rows, 1.2),
    mergeBackground: true,
  });

  const backgroundOf = (config: CompartmentConfig): number[] => config.backgroundIds ?? [];

  it('leaves one leftover region around a centred compartment', () => {
    const { config } = draw(mergedGrid(), 1, 1, 1, 1);
    // The U wraps the drawn cell: one background id, one drawn id.
    expect(backgroundOf(config)).toHaveLength(1);
    expect(new Set(config.cells).size).toBe(2);
    expect(getDrawnCompartmentIds(config).size).toBe(1);
  });

  it('keeps a drawn 1x1 out of the leftover it sits in', () => {
    const { config, id } = draw(mergedGrid(), 0, 0, 1, 1);
    expect(config.cells.filter((c) => c === id)).toHaveLength(1);
    expect(getDrawnCompartmentIds(config).has(id)).toBe(true);
  });

  it('splits leftover into one region per disconnected area', () => {
    // A full column of drawn cells cuts the 3x3 grid in two.
    let config = mergedGrid();
    config = draw(config, 1, 0, 1, 3).config;
    expect(backgroundOf(config)).toHaveLength(2);
  });

  it('treats a merged leftover region as background, not as a drawn compartment', () => {
    const { config } = draw(mergedGrid(), 1, 1, 1, 1);
    const backgroundId = backgroundOf(config)[0];
    // Multi-cell would otherwise read as drawn.
    expect(config.cells.filter((c) => c === backgroundId).length).toBeGreaterThan(1);
    expect(getDrawnCompartmentIds(config).has(backgroundId)).toBe(false);
  });

  it('collapses an empty grid to a single pocket', () => {
    const cleared = clearDrawnCompartments(mergedGrid());
    expect(new Set(cleared.cells).size).toBe(1);
    expect(backgroundOf(cleared)).toHaveLength(1);
  });

  it('re-merges the leftover a removed compartment gives back', () => {
    const drawn = draw(mergedGrid(), 1, 1, 1, 1);
    const removed = removeCompartment(drawn.config, drawn.id);
    expect(removed).not.toBeNull();
    expect(new Set(removed?.cells).size).toBe(1);
  });

  it('is off by default, leaving every cell its own pocket', () => {
    const { config } = draw(grid(3, 3), 1, 1, 1, 1);
    expect(config.backgroundIds).toBeUndefined();
    expect(new Set(config.cells).size).toBe(9);
  });
});

/**
 * A merged compartment is the one case where a compartment does not fill its
 * bounding box, so every op that rebuilds cells from `getCompartmentRect` alone
 * silently flattens it back to a rectangle.
 */
describe('bentoDraw preserves merged (non-rectangular) footprints', () => {
  /** Cells of a compartment as sorted `col,row` strings, for shape assertions. */
  const shapeOf = (config: CompartmentConfig, id: number): string[] =>
    getCellsForCompartment(config, id)
      .map((idx) => `${idx % config.cols},${Math.floor(idx / config.cols)}`)
      .sort();

  const idWithCellCount = (config: CompartmentConfig, count: number): number => {
    const found = [...getDrawnCompartmentIds(config)].find(
      (id) => getCellsForCompartment(config, id).length === count
    );
    expect(found).toBeDefined();
    if (found === undefined) throw new Error('unreachable');
    return found;
  };

  /** An L over (0,0) (1,0) (0,1): three cells in a 2×2 bounding box. */
  const mergedL = (base: CompartmentConfig = grid(4, 3)) => {
    const first = draw(base, 0, 0, 2, 1);
    const second = draw(first.config, 0, 1, 1, 1);
    const merged = mergeCompartments(second.config, [...getDrawnCompartmentIds(second.config)]);
    expect(merged).not.toBeNull();
    if (!merged) throw new Error('unreachable');
    expect(shapeOf(merged.config, merged.id)).toEqual(['0,0', '0,1', '1,0']);
    return merged;
  };

  it('moveCompartment translates the L instead of filling its bounding box', () => {
    const { config, id } = mergedL();
    const moved = moveCompartment(config, id, 2, 1);
    expect(moved).not.toBeNull();
    if (!moved) throw new Error('unreachable');
    expect(shapeOf(moved.config, moved.id)).toEqual(['2,1', '2,2', '3,1']);
    expect(validateCompartmentGrid(moved.config)).toEqual([]);
  });

  it('moveCompartment fits an L into an L-shaped gap its bounding box overlaps', () => {
    const { config } = mergedL();
    // A blocker in the notch the L leaves empty at its destination: bounding-box
    // collision rejects the move, footprint collision allows it.
    const blocked = draw(config, 3, 2, 1, 1);
    const l = idWithCellCount(blocked.config, 3);
    const moved = moveCompartment(blocked.config, l, 2, 1);
    expect(moved).not.toBeNull();
    if (!moved) throw new Error('unreachable');
    expect(shapeOf(moved.config, moved.id)).toEqual(['2,1', '2,2', '3,1']);
  });

  it('duplicateCompartment stamps the L, not its bounding rectangle', () => {
    const { config, id } = mergedL();
    const copy = duplicateCompartment(config, id, { col: 2, row: 1, w: 2, h: 2 });
    expect(copy).not.toBeNull();
    if (!copy) throw new Error('unreachable');
    expect(shapeOf(copy.config, copy.id)).toEqual(['2,1', '2,2', '3,1']);
    expect(shapeOf(copy.config, idWithCellCount(copy.config, 3))).toHaveLength(3);
  });

  it('stashCompartment records the footprint and placeFromStash restores it', () => {
    const { config, id } = mergedL();
    const stashed = stashCompartment(config, id);
    expect(stashed).not.toBeNull();
    if (!stashed) throw new Error('unreachable');
    expect(stashed.stash).toEqual([{ w: 2, h: 2, cells: [0, 1, 2] }]);
    const placed = placeFromStash(stashed, 0, { col: 2, row: 1, w: 2, h: 2 });
    expect(placed).not.toBeNull();
    if (!placed) throw new Error('unreachable');
    expect(shapeOf(placed.config, placed.id)).toEqual(['2,1', '2,2', '3,1']);
  });

  it('resizeGridPreservingCompartments keeps the L intact when the grid grows', () => {
    const { config } = mergedL();
    const regrid = resizeGridPreservingCompartments(config, 6, 5);
    expect(regrid.stashedCount).toBe(0);
    expect(shapeOf(regrid.config, idWithCellCount(regrid.config, 3))).toEqual([
      '0,0',
      '0,1',
      '1,0',
    ]);
    expect(validateCompartmentGrid(regrid.config)).toEqual([]);
  });

  it('stashes an L whole when the grid shrinks past it', () => {
    const { config } = mergedL(grid(5, 4));
    const regrid = resizeGridPreservingCompartments(config, 5, 1);
    expect(regrid.stashedCount).toBe(1);
    expect(regrid.config.stash).toEqual([{ w: 2, h: 2, cells: [0, 1, 2] }]);
  });
});
