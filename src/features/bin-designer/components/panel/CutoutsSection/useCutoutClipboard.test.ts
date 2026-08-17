import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Cutout } from '@/features/bin-designer/types';
import { useCutoutClipboard } from './useCutoutClipboard';
import { PASTE_OFFSET } from './cutoutInteractionTypes';

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
function harness(initial: Cutout[], capacity = Infinity) {
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
        binWidth: 500,
        binDepth: 500,
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
      cutouts = cutouts.map((c) => (selection.has(c.id) ? { ...c, x: c.x + dx, y: c.y + dy } : c));
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
