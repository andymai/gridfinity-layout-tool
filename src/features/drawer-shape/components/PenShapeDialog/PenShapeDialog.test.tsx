import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { DrawerOutline } from '@/core/types';
import { ok } from '@/core/result';
import { useLayoutStore } from '@/core/store';
import { resetAllStores } from '@/test/testUtils';
import { PenShapeDialog } from './PenShapeDialog';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const setDrawerOutline = vi.fn((_outline: DrawerOutline | null) => ok(undefined));
vi.mock('@/shared/contexts/MutationsContext', () => ({
  useMutations: () => ({ setDrawerOutline }),
}));

/** Drawer-local mm extent of the default test drawer. */
function extent(): { w: number; d: number } {
  const { layout } = useLayoutStore.getState();
  return { w: layout.drawer.width * layout.gridUnitMm, d: layout.drawer.depth * layout.gridUnitMm };
}

function setOutline(vertices: DrawerOutline['vertices']): void {
  useLayoutStore.setState((state) => ({
    layout: { ...state.layout, drawer: { ...state.layout.drawer, outline: { vertices } } },
  }));
}

describe('PenShapeDialog', () => {
  beforeEach(() => {
    resetAllStores();
    setDrawerOutline.mockClear();
  });

  it('renders nothing while closed', () => {
    const { container } = render(<PenShapeDialog open={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('seeds a new sketch from the drawer rectangle', () => {
    render(<PenShapeDialog open onClose={vi.fn()} />);
    const { w, d } = extent();
    // Four corners, and the path closes.
    const path = document.querySelector('path');
    expect(path?.getAttribute('d')).toBe(`M 0 0 L ${w} 0 L ${w} ${d} L 0 ${d} Z`);
  });

  // Reopening has to restore what is stored, or the editor silently discards a
  // shape the moment it opens.
  it('seeds from an existing outline, whichever surface authored it', () => {
    const { w, d } = extent();
    setOutline([
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: d / 2 },
      { x: 0, y: d },
    ]);
    render(<PenShapeDialog open onClose={vi.fn()} />);
    expect(document.querySelector('path')?.getAttribute('d')).toBe(
      `M 0 0 L ${w} 0 L ${w} ${d / 2} L 0 ${d} Z`
    );
  });

  // The dialog stays mounted while closed, so nothing unmounts the sketch. A
  // reopen must show what is stored, not the last session's edits.
  it('reseeds from the store when reopened rather than keeping stale vertices', () => {
    const { w, d } = extent();
    const { rerender } = render(<PenShapeDialog open onClose={vi.fn()} />);
    const svg = screen.getByRole('application');
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 448, height: 364 }) as DOMRect;

    // Edit, then close without applying.
    fireEvent.pointerDown(svg, { clientX: 14, clientY: 350 });
    fireEvent.pointerMove(svg, { clientX: 120, clientY: 300 });
    fireEvent.pointerUp(svg);
    const edited = document.querySelector('path')?.getAttribute('d');
    expect(edited).not.toBe(`M 0 0 L ${w} 0 L ${w} ${d} L 0 ${d} Z`);
    rerender(<PenShapeDialog open={false} onClose={vi.fn()} />);

    rerender(<PenShapeDialog open onClose={vi.fn()} />);
    expect(document.querySelector('path')?.getAttribute('d')).toBe(
      `M 0 0 L ${w} 0 L ${w} ${d} L 0 ${d} Z`
    );
  });

  it('clears the undo history on reopen, so it cannot reach a past session', () => {
    const { rerender } = render(<PenShapeDialog open onClose={vi.fn()} />);
    const svg = screen.getByRole('application');
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 448, height: 364 }) as DOMRect;
    fireEvent.pointerDown(svg, { clientX: 14, clientY: 350 });
    fireEvent.pointerMove(svg, { clientX: 120, clientY: 300 });
    fireEvent.pointerUp(svg);
    expect(screen.getByText('common.undo')).toBeEnabled();

    rerender(<PenShapeDialog open={false} onClose={vi.fn()} />);
    rerender(<PenShapeDialog open onClose={vi.fn()} />);
    expect(screen.getByText('common.undo')).toBeDisabled();
  });

  it('applies the sketch as a pen-authored outline and closes', () => {
    const onClose = vi.fn();
    render(<PenShapeDialog open onClose={onClose} />);

    fireEvent.click(screen.getByText('drawerShape.editor.apply'));

    expect(setDrawerOutline).toHaveBeenCalledTimes(1);
    const applied = setDrawerOutline.mock.calls[0][0];
    expect(applied?.authoring).toEqual({ kind: 'pen' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // The dialog grades the sketch with the same validator the commit uses, so an
  // invalid shape can never reach the store from here.
  it('blocks apply and explains why when the outline is invalid', () => {
    const { w, d } = extent();
    // Bow-tie: a self-intersecting loop.
    setOutline([
      { x: 0, y: 0 },
      { x: w, y: d },
      { x: w, y: 0 },
      { x: 0, y: d },
    ]);
    render(<PenShapeDialog open onClose={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('drawerShape.penError.self_intersecting');
    const apply = screen.getByText('drawerShape.editor.apply');
    expect(apply).toBeDisabled();
    fireEvent.click(apply);
    expect(setDrawerOutline).not.toHaveBeenCalled();
  });

  it('resets the sketch back to the drawer rectangle', () => {
    const { w, d } = extent();
    setOutline([
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w / 2, y: d },
    ]);
    render(<PenShapeDialog open onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('drawerShape.penReset'));

    expect(document.querySelector('path')?.getAttribute('d')).toBe(
      `M 0 0 L ${w} 0 L ${w} ${d} L 0 ${d} Z`
    );
  });

  it('keeps the delete action off until a corner is selected', () => {
    render(<PenShapeDialog open onClose={vi.fn()} />);
    expect(screen.getByText('drawerShape.penDeletePoint')).toBeDisabled();
  });

  it('discards the sketch on cancel rather than committing it', () => {
    const onClose = vi.fn();
    render(<PenShapeDialog open onClose={onClose} />);

    fireEvent.click(screen.getByText('common.cancel'));

    expect(setDrawerOutline).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Rounding is baked into the stored vertices as arcs, so the plate, the
  // layout hatching and placement all see the same shape.
  it('bakes rounded corners into the applied outline as arcs', () => {
    render(<PenShapeDialog open onClose={vi.fn()} />);

    const stepper = screen.getByLabelText('drawerShape.penFillet');
    fireEvent.change(stepper, { target: { value: '20' } });
    fireEvent.blur(stepper);
    fireEvent.click(screen.getByText('drawerShape.editor.apply'));

    const applied = setDrawerOutline.mock.calls[0][0];
    expect(applied).not.toBeNull();
    // A rounded rectangle is eight points, four of them carrying an arc.
    expect(applied?.vertices).toHaveLength(8);
    expect(applied?.vertices.filter((v) => (v.bulge ?? 0) !== 0)).toHaveLength(4);
  });

  // role="application" tells assistive technology the canvas handles its own
  // keys, so it has to actually do so — and a vector editor is expected to be
  // driveable from the keyboard regardless.
  describe('keyboard editing', () => {
    const canvas = () => screen.getByRole('application');

    /** Select the first corner by pressing on it, which pointer tests also do. */
    function selectFirstCorner(): void {
      const svg = canvas();
      svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 448, height: 364 }) as DOMRect;
      fireEvent.pointerDown(svg, { clientX: 14, clientY: 350 });
      fireEvent.pointerUp(svg);
    }

    it('is focusable', () => {
      render(<PenShapeDialog open onClose={vi.fn()} />);
      expect(canvas()).toHaveAttribute('tabindex', '0');
    });

    it('nudges the selected corner with an arrow key', () => {
      render(<PenShapeDialog open onClose={vi.fn()} />);
      selectFirstCorner();
      const before = document.querySelector('path')?.getAttribute('d');

      fireEvent.keyDown(canvas(), { key: 'ArrowRight' });

      expect(document.querySelector('path')?.getAttribute('d')).not.toBe(before);
    });

    it('undoes the nudge with Ctrl+Z', () => {
      render(<PenShapeDialog open onClose={vi.fn()} />);
      selectFirstCorner();
      const before = document.querySelector('path')?.getAttribute('d');

      fireEvent.keyDown(canvas(), { key: 'ArrowRight' });
      fireEvent.keyDown(canvas(), { key: 'z', ctrlKey: true });

      expect(document.querySelector('path')?.getAttribute('d')).toBe(before);
    });

    // Figma keeps your selection through an undo; losing it makes the
    // coordinate fields blink out mid-edit.
    it('keeps the selected corner through an undo', () => {
      render(<PenShapeDialog open onClose={vi.fn()} />);
      selectFirstCorner();
      fireEvent.keyDown(canvas(), { key: 'ArrowRight' });
      fireEvent.keyDown(canvas(), { key: 'z', ctrlKey: true });

      expect(screen.getByText('drawerShape.penDeletePoint')).toBeEnabled();
    });

    it('drops a selection an undo has invalidated', () => {
      render(<PenShapeDialog open onClose={vi.fn()} />);
      selectFirstCorner();
      // Insert on the LAST segment, so the new corner takes the final index.
      // Undoing then shortens the list past that index, which is the case the
      // bound filter has to catch; inserting earlier would leave the index
      // valid and the selection would rightly survive.
      fireEvent.doubleClick(canvas(), { clientX: 14, clientY: 182 });
      fireEvent.keyDown(canvas(), { key: 'z', ctrlKey: true });

      // Selection cleared, so delete has nothing to act on.
      expect(screen.getByText('drawerShape.penDeletePoint')).toBeDisabled();
    });

    it('clears the selection on Escape', () => {
      render(<PenShapeDialog open onClose={vi.fn()} />);
      selectFirstCorner();
      expect(screen.getByText('drawerShape.penDeletePoint')).toBeEnabled();

      fireEvent.keyDown(canvas(), { key: 'Escape' });

      expect(screen.getByText('drawerShape.penDeletePoint')).toBeDisabled();
    });

    it('removes the selected corner with Delete', () => {
      render(<PenShapeDialog open onClose={vi.fn()} />);
      selectFirstCorner();

      fireEvent.keyDown(canvas(), { key: 'Delete' });
      fireEvent.click(screen.getByText('drawerShape.editor.apply'));

      expect(setDrawerOutline.mock.calls[0][0]?.vertices).toHaveLength(3);
    });
  });

  it('keeps undo unavailable until something has been edited', () => {
    render(<PenShapeDialog open onClose={vi.fn()} />);
    expect(screen.getByText('common.undo')).toBeDisabled();
  });

  describe('view', () => {
    const canvas = () => screen.getByRole('application');
    const rect = () => ({ left: 0, top: 0, width: 448, height: 364 }) as DOMRect;

    it('starts at the default framing with no reset offered', () => {
      render(<PenShapeDialog open onClose={vi.fn()} />);
      expect(canvas()).toHaveAttribute('viewBox', '0 0 448 364');
      expect(screen.queryByText('drawerShape.penResetView')).not.toBeInTheDocument();
    });

    it('zooms toward the pointer on scroll', () => {
      render(<PenShapeDialog open onClose={vi.fn()} />);
      const svg = canvas();
      svg.getBoundingClientRect = rect;

      fireEvent.wheel(svg, { deltaY: -100, clientX: 224, clientY: 182 });

      const vb = svg.getAttribute('viewBox')?.split(' ').map(Number) ?? [];
      // Narrower window means zoomed in, and it stays centred on the anchor.
      expect(vb[2]).toBeLessThan(448);
      expect(vb[0]).toBeGreaterThan(0);
      expect(screen.getByText('drawerShape.penResetView')).toBeInTheDocument();
    });

    it('restores the default framing from the reset control', () => {
      render(<PenShapeDialog open onClose={vi.fn()} />);
      const svg = canvas();
      svg.getBoundingClientRect = rect;
      fireEvent.wheel(svg, { deltaY: -100, clientX: 224, clientY: 182 });

      fireEvent.click(screen.getByText('drawerShape.penResetView'));

      expect(svg).toHaveAttribute('viewBox', '0 0 448 364');
    });

    // Background drag is the marquee, as in Figma, so panning is an explicit
    // gesture: Alt (or space, or the middle button).
    it('pans on an Alt drag', () => {
      render(<PenShapeDialog open onClose={vi.fn()} />);
      const svg = canvas();
      svg.getBoundingClientRect = rect;
      // Pan only has room once zoomed in; at 1x the window fills the frame.
      fireEvent.wheel(svg, { deltaY: -100, clientX: 224, clientY: 182 });
      const before = svg.getAttribute('viewBox');

      fireEvent.pointerDown(svg, { clientX: 224, clientY: 182, altKey: true });
      fireEvent.pointerMove(svg, { clientX: 180, clientY: 150 });
      fireEvent.pointerUp(svg);

      expect(svg.getAttribute('viewBox')).not.toBe(before);
    });
  });

  // Shift locks the drag to one axis, so an edge can be moved without drifting
  // off square — the constraint every vector editor offers.
  it('constrains a corner drag to one axis with Shift', () => {
    render(<PenShapeDialog open onClose={vi.fn()} />);
    const svg = screen.getByRole('application');
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 448, height: 364 }) as DOMRect;

    // Grab the front-left corner, then drag diagonally with Shift held.
    fireEvent.pointerDown(svg, { clientX: 14, clientY: 350 });
    fireEvent.pointerMove(svg, { clientX: 120, clientY: 300, shiftKey: true });
    fireEvent.pointerUp(svg);
    fireEvent.click(screen.getByText('drawerShape.editor.apply'));

    const v = setDrawerOutline.mock.calls[0][0]?.vertices[0];
    expect(v).toBeDefined();
    // X moved further than Y, so Y is pinned back to where the drag started.
    expect(v?.y).toBe(0);
    expect(v?.x).toBeGreaterThan(0);
  });

  describe('multi-select', () => {
    const canvas = () => screen.getByRole('application');
    const rect = () => ({ left: 0, top: 0, width: 448, height: 364 }) as DOMRect;
    /** Screen point for a drawer-local mm coordinate, in the default view. */
    const at = (x: number, y: number) => ({ clientX: x + 14, clientY: 364 - 14 - y });

    function setup() {
      render(<PenShapeDialog open onClose={vi.fn()} />);
      const svg = canvas();
      svg.getBoundingClientRect = rect;
      return svg;
    }

    it('adds a second corner with Shift-click', () => {
      const svg = setup();
      fireEvent.pointerDown(svg, at(0, 0));
      fireEvent.pointerUp(svg);
      fireEvent.pointerDown(svg, { ...at(420, 0), shiftKey: true });
      fireEvent.pointerUp(svg);

      // Two selected: the single-corner coordinate panel gives way, and delete
      // is refused because two of four would leave less than a triangle.
      expect(screen.queryByText(/^drawerShape\.penCorner/)).not.toBeInTheDocument();
      expect(screen.getByText('drawerShape.penDeletePoint')).toBeDisabled();
    });

    it('moves every selected corner together', () => {
      const svg = setup();
      fireEvent.pointerDown(svg, at(0, 0));
      fireEvent.pointerUp(svg);
      fireEvent.pointerDown(svg, { ...at(420, 0), shiftKey: true });
      fireEvent.pointerUp(svg);
      // Drag one of the pair upward; both should rise.
      fireEvent.pointerDown(svg, at(420, 0));
      fireEvent.pointerMove(svg, at(420, 42));
      fireEvent.pointerUp(svg);
      fireEvent.click(screen.getByText('drawerShape.editor.apply'));

      const v = setDrawerOutline.mock.calls[0][0]?.vertices ?? [];
      expect(v[0].y).toBeGreaterThan(0);
      expect(v[1].y).toBeGreaterThan(0);
    });

    it('selects the corners a marquee encloses', () => {
      const svg = setup();
      // Start clear of every corner, or the press would grab one and drag it
      // instead of opening a marquee, then sweep the two corners at y = 0.
      fireEvent.pointerDown(svg, at(-10, 60));
      fireEvent.pointerMove(svg, at(430, -10));
      fireEvent.pointerUp(svg);

      // Nudge and read the result: asserting only that delete is refused would
      // hold just as well if the sweep had selected nothing at all.
      fireEvent.keyDown(svg, { key: 'ArrowUp' });
      fireEvent.click(screen.getByText('drawerShape.editor.apply'));

      const v = setDrawerOutline.mock.calls[0][0]?.vertices ?? [];
      expect(v[0].y).toBeGreaterThan(0);
      expect(v[1].y).toBeGreaterThan(0);
      // The two corners the sweep missed stay where they were.
      expect(v[2].y).toBe(336);
      expect(v[3].y).toBe(336);
    });

    it('selects everything with Ctrl+A', () => {
      // Inset from the walls, so a nudge has somewhere to go: the default
      // rectangle spans the drawer and the group clamp rightly refuses to move
      // it, which would make this pass whatever Ctrl+A selected.
      setOutline([
        { x: 42, y: 42 },
        { x: 210, y: 42 },
        { x: 210, y: 210 },
        { x: 42, y: 210 },
      ]);
      const svg = setup();
      fireEvent.keyDown(svg, { key: 'a', ctrlKey: true });
      fireEvent.keyDown(svg, { key: 'ArrowRight' });
      fireEvent.click(screen.getByText('drawerShape.editor.apply'));

      // Every corner moved by the same step, which only happens if all four
      // were selected — a delete-disabled assertion would pass on none.
      const v = setDrawerOutline.mock.calls[0][0]?.vertices ?? [];
      expect(v).toHaveLength(4);
      expect(v.every((c) => c.x > 42)).toBe(true);
    });
  });
});
