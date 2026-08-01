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
      // Delete leaves three corners, so undoing back to four is fine, but the
      // reverse case (selection past the end) must clear.
      fireEvent.keyDown(canvas(), { key: 'Delete' });
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
});
