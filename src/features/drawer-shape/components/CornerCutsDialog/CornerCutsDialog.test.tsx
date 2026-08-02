import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useLayoutStore } from '@/core/store';
import { resetAllStores } from '@/test/testUtils';
import type { Drawer, DrawerOutline } from '@/core/types';
import { gridUnits } from '@/core/types';
import { CornerCutsDialog } from './CornerCutsDialog';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

const mockSetDrawerOutline = vi.fn((_outline: DrawerOutline | null) => ({
  ok: true,
  value: undefined,
}));
vi.mock('@/shared/contexts/MutationsContext', () => ({
  useMutations: () => ({ setDrawerOutline: mockSetDrawerOutline }),
}));

function kindSelect(cornerKey: string): HTMLSelectElement {
  return screen.getByRole('combobox', {
    name: `drawerShape.corners.${cornerKey}`,
  });
}

function setDrawer(patch: Partial<Drawer>): void {
  useLayoutStore.setState((s) => ({
    layout: { ...s.layout, drawer: { ...s.layout.drawer, ...patch } },
  }));
}

/** A front-left 30mm chamfer on a 4×4 drawer, with its authoring echo. */
const CHAMFER_OUTLINE: DrawerOutline = {
  vertices: [
    { x: 0, y: 30 },
    { x: 30, y: 0 },
    { x: 168, y: 0 },
    { x: 168, y: 168 },
    { x: 0, y: 168 },
  ],
  authoring: {
    kind: 'corners',
    corners: {
      tl: { kind: 'none' },
      tr: { kind: 'none' },
      bl: { kind: 'chamfer', size: 30 },
      br: { kind: 'none' },
    },
  },
};

describe('CornerCutsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('applies a chamfer as an outline with corners authoring', () => {
    const onClose = vi.fn();
    render(<CornerCutsDialog open onClose={onClose} />);
    fireEvent.change(kindSelect('backRight'), { target: { value: 'chamfer' } });
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.editor.apply' }));

    expect(mockSetDrawerOutline).toHaveBeenCalledTimes(1);
    const outline = mockSetDrawerOutline.mock.calls[0][0];
    if (outline === null) throw new Error('expected an outline, got null');
    expect(outline.authoring?.kind).toBe('corners');
    expect(outline.authoring?.corners?.tr.kind).toBe('chamfer');
    expect(onClose).toHaveBeenCalled();
  });

  it('clears the outline when every corner returns to none', () => {
    render(<CornerCutsDialog open onClose={() => {}} />);
    fireEvent.change(kindSelect('frontLeft'), { target: { value: 'radius' } });
    fireEvent.change(kindSelect('frontLeft'), { target: { value: 'none' } });
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.editor.apply' }));
    expect(mockSetDrawerOutline).toHaveBeenCalledWith(null);
  });

  it('seeds from an existing corners outline for round-trip editing', () => {
    // The echo is only trusted when it reproduces the vertices at the
    // CURRENT drawer size, so the drawer must match the 4×4 fixture.
    setDrawer({ width: gridUnits(4), depth: gridUnits(4), outline: CHAMFER_OUTLINE });
    render(<CornerCutsDialog open onClose={() => {}} />);
    expect(kindSelect('frontLeft').value).toBe('chamfer');
  });

  it('confirms before replacing a corners shape whose echo went stale (#3149)', () => {
    // Same cuts, but on the default 10×8 drawer: the annotation still says
    // 'corners' while re-inscribing it on the NEW rectangle would replace the
    // actual (now sub-rect) shape — the geometry check must treat it as
    // foreign and ask first.
    setDrawer({ outline: CHAMFER_OUTLINE });
    render(<CornerCutsDialog open onClose={() => {}} />);
    // Stale echo must not seed the pickers either.
    expect(kindSelect('frontLeft').value).toBe('none');
    fireEvent.change(kindSelect('backLeft'), { target: { value: 'radius' } });
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.editor.apply' }));
    expect(mockSetDrawerOutline).not.toHaveBeenCalled();
    expect(screen.getByText('drawerShape.corners.replaceTitle')).toBeInTheDocument();
  });

  it('confirms before replacing a shape drawn with another editor', () => {
    setDrawer({
      outline: {
        vertices: [
          { x: 0, y: 0 },
          { x: 168, y: 0 },
          { x: 168, y: 84 },
          { x: 84, y: 84 },
          { x: 84, y: 168 },
          { x: 0, y: 168 },
        ],
        authoring: { kind: 'cells' },
      },
    });
    render(<CornerCutsDialog open onClose={() => {}} />);
    fireEvent.change(kindSelect('backLeft'), { target: { value: 'radius' } });
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.editor.apply' }));
    expect(mockSetDrawerOutline).not.toHaveBeenCalled();
    expect(screen.getByText('drawerShape.corners.replaceTitle')).toBeInTheDocument();
  });
});

describe('review regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('stepper +/- steps from the current value (delta semantics)', () => {
    render(<CornerCutsDialog open onClose={() => {}} />);
    fireEvent.change(kindSelect('backRight'), { target: { value: 'chamfer' } });
    // Default seed is 21mm; one + click must yield 22, not 1.
    const plus = screen.getAllByRole('button', { name: /increase|increment|\+/i })[0];
    fireEvent.click(plus);
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.editor.apply' }));
    const outline = mockSetDrawerOutline.mock.calls[0][0];
    if (outline === null) throw new Error('expected an outline, got null');
    expect(outline.authoring?.corners?.tr).toEqual({ kind: 'chamfer', size: 22 });
  });

  it('treats a corners outline with a stripped annotation as foreign (confirms)', () => {
    setDrawer({
      // An older server stripped `corners` — only the kind survived.
      outline: { vertices: CHAMFER_OUTLINE.vertices, authoring: { kind: 'corners' } },
    });
    render(<CornerCutsDialog open onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.editor.apply' }));
    expect(mockSetDrawerOutline).not.toHaveBeenCalled();
    expect(screen.getByText('drawerShape.corners.replaceTitle')).toBeInTheDocument();
  });
});
