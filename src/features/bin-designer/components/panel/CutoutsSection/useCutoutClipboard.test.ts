import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Cutout } from '@/features/bin-designer/types';
import { useCutoutClipboard } from './useCutoutClipboard';
import { PASTE_OFFSET } from './cutoutInteractionTypes';
import { translateCutout } from './cutoutHelpers';

vi.mock('@/shared/analytics/posthog', () => ({ trackEvent: vi.fn() }));

function cutout(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'a',
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 10,
    depth: 10,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

/**
 * Drives the hook the way the editor does: `cutouts` and `selection` are owned
 * outside it, so a duplicate has to be reflected back before the next call.
 */
function harness(
  initial: Cutout[],
  capacity = Infinity,
  mask?: Pick<Parameters<typeof useCutoutClipboard>[0], 'cellMask' | 'maskCellSize'> & {
    readonly binWidth: number;
    readonly binDepth: number;
  }
) {
  let cutouts = initial;
  let selection = new Set(initial.map((c) => c.id));
  const added: Cutout[] = [];

  const rendered = renderHook(
    (props: { cutouts: Cutout[]; selection: Set<string> }) =>
      useCutoutClipboard({
        cutouts: props.cutouts,
        selection: props.selection,
        setSelection: (sel) => {
          selection = new Set(sel);
        },
        onAdd: (c) => {
          // Mirrors the store: a target at its cap refuses the write and says so.
          if (added.length >= capacity) return false;
          added.push(c);
          cutouts = [...cutouts, c];
          return true;
        },
        binWidth: mask?.binWidth ?? 500,
        binDepth: mask?.binDepth ?? 500,
        cellMask: mask?.cellMask,
        maskCellSize: mask?.maskCellSize,
      }),
    { initialProps: { cutouts, selection } }
  );

  return {
    added,
    selection: () => selection,
    duplicate: () => {
      act(() => rendered.result.current.duplicateSelected());
      rendered.rerender({ cutouts, selection });
    },
    /** Simulate the user dragging the current selection somewhere. */
    moveSelection: (dx: number, dy: number) => {
      cutouts = cutouts.map((c) => (selection.has(c.id) ? translateCutout(c, dx, dy) : c));
      rendered.rerender({ cutouts, selection });
    },
    last: () => added[added.length - 1],
  };
}

describe('duplicate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('offsets the first copy by the standard nudge', () => {
    const h = harness([cutout()]);

    h.duplicate();

    expect(h.last()).toMatchObject({ x: PASTE_OFFSET, y: PASTE_OFFSET });
  });

  it('keeps nudging when the copy is left where it landed', () => {
    const h = harness([cutout()]);

    h.duplicate();
    h.duplicate();

    expect(h.last()).toMatchObject({ x: PASTE_OFFSET * 2, y: PASTE_OFFSET * 2 });
  });
});

describe('step and repeat', () => {
  beforeEach(() => vi.clearAllMocks());

  it('repeats the placement once a copy has been moved deliberately', () => {
    const h = harness([cutout()]);

    h.duplicate(); // copy lands at (2, 2)
    h.moveSelection(28, -2); // user drags it to (30, 0)
    h.duplicate();

    expect(h.last()).toMatchObject({ x: 60, y: 0 });
  });

  it('keeps stepping for as long as the chain continues', () => {
    const h = harness([cutout()]);

    h.duplicate();
    h.moveSelection(28, -2); // step becomes (30, 0)
    h.duplicate();
    h.duplicate();

    expect(h.last()).toMatchObject({ x: 90, y: 0 });
  });

  it('re-aims from the newest copy, not from the original', () => {
    const h = harness([cutout()]);

    h.duplicate();
    h.moveSelection(28, -2); // first copy sits at (30, 0)
    h.duplicate(); // second copy lands at (60, 0)
    // Dragging the second copy to (20, 20) makes the placement delta from its
    // own source at (30, 0) equal to (-10, 20) — which is what repeats next.
    h.moveSelection(-40, 20);
    h.duplicate();

    expect(h.last()).toMatchObject({ x: 10, y: 40 });
  });

  it('starts over when the chain is broken by selecting something else', () => {
    const other = cutout({ id: 'other', x: 200, y: 200 });
    const h = harness([cutout(), other]);

    h.duplicate();
    h.moveSelection(28, -2);
    h.duplicate();

    // Both originals were selected the whole time, so this was never a
    // single-shape chain; the offset stays the plain nudge.
    expect(h.added).toHaveLength(4);
  });
});

describe('a target at its cap', () => {
  beforeEach(() => vi.clearAllMocks());

  it('selects only the clones that were stored', () => {
    // Three shapes duplicated with room for two: the third is refused, and
    // selecting its id would leave the editor holding a shape that does not
    // exist — which the step chain then measures its next offset against.
    const h = harness([cutout({ id: 'a' }), cutout({ id: 'b' }), cutout({ id: 'c' })], 2);

    h.duplicate();

    expect(h.added).toHaveLength(2);
    expect(h.selection().size).toBe(2);
    expect([...h.selection()]).toEqual(h.added.map((c) => c.id));
  });

  it('selects nothing when there is no room at all', () => {
    const h = harness([cutout()], 0);

    h.duplicate();

    expect(h.added).toHaveLength(0);
    expect(h.selection().size).toBe(0);
  });
});

describe('a masked board', () => {
  beforeEach(() => vi.clearAllMocks());

  // Three 20mm cells, the last one cut away.
  const mask = {
    cellMask: { cols: 3, rows: 1, cells: [1, 1, 0] as (0 | 1)[] },
    maskCellSize: { cellMmX: 20, cellMmY: 20 },
    binWidth: 60,
    binDepth: 20,
  };
  const at = (x: number, y: number) => ({
    x,
    y,
    handleIn: null,
    handleOut: null,
    symmetric: false,
  });

  // A path's points are absolute, so the check has to look at the copy where
  // it lands, not at the shape it was copied from.
  it('refuses a path copy that would land over a missing cell', () => {
    const square = cutout({
      shape: 'path',
      x: 2,
      y: 4,
      width: 6,
      depth: 6,
      path: [at(2, 4), at(8, 4), at(8, 10), at(2, 10)],
    });
    const h = harness([square], Infinity, mask);
    h.duplicate();
    h.moveSelection(20, 0);
    const before = h.added.length;

    // The chain repeats the 22mm step, onto the missing third cell.
    h.duplicate();

    expect(h.added).toHaveLength(before);
  });
});
