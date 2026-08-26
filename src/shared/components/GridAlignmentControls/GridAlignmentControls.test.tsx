import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useLayoutStore } from '@/core/store';
import { resetAllStores } from '@/test/testUtils';
import { gridUnits, mm } from '@/core/types';
import type { DrawerOutline, StoredBaseplateParams } from '@/core/types';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { GridAlignmentControls } from './GridAlignmentControls';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

const mockUpdateDrawer = vi.fn();
vi.mock('@/shared/contexts/MutationsContext', () => ({
  useMutations: () => ({ updateDrawer: mockUpdateDrawer }),
}));

const U = 42;

/** 84×84mm square at (10,10) inside a 4×4 drawer: off-lattice by design —
 * the lattice registration is exactly (+32, +32). */
const OFF_LATTICE: DrawerOutline = {
  vertices: [
    { x: 10, y: 10 },
    { x: 94, y: 10 },
    { x: 94, y: 94 },
    { x: 10, y: 94 },
  ],
};

/** Corner-anchored L filling the 4×4 extent: registration is zero. */
const REGISTERED: DrawerOutline = {
  vertices: [
    { x: 0, y: 0 },
    { x: 4 * U, y: 0 },
    { x: 4 * U, y: 2 * U },
    { x: 2 * U, y: 2 * U },
    { x: 2 * U, y: 4 * U },
    { x: 0, y: 4 * U },
  ],
};

function setDrawer(
  outline: DrawerOutline | undefined,
  extra: { gridShiftX?: number; gridShiftY?: number } = {},
  baseplateParams?: Partial<StoredBaseplateParams>
): void {
  useLayoutStore.setState((s) => ({
    layout: {
      ...s.layout,
      gridUnitMm: mm(U),
      drawer: {
        ...s.layout.drawer,
        width: gridUnits(4),
        depth: gridUnits(4),
        outline,
        ...(extra.gridShiftX !== undefined ? { gridShiftX: mm(extra.gridShiftX) } : {}),
        ...(extra.gridShiftY !== undefined ? { gridShiftY: mm(extra.gridShiftY) } : {}),
      },
      ...(baseplateParams !== undefined
        ? { baseplateParams: { ...DEFAULT_BASEPLATE_PARAMS, ...baseplateParams } }
        : {}),
    },
  }));
}

describe('GridAlignmentControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('renders nothing without a custom outline', () => {
    setDrawer(undefined);
    const { container } = render(<GridAlignmentControls />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the baseplate does not sync with the layout', () => {
    setDrawer(OFF_LATTICE, {}, { syncWithLayout: false });
    const { container } = render(<GridAlignmentControls />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders X and Y shift steppers for a shaped drawer', () => {
    setDrawer(OFF_LATTICE);
    render(<GridAlignmentControls />);
    expect(screen.getByLabelText('drawerShape.gridAlignment.shiftX')).toBeInTheDocument();
    expect(screen.getByLabelText('drawerShape.gridAlignment.shiftY')).toBeInTheDocument();
  });

  it('shows the alignment hint when the frame shift is non-zero', () => {
    setDrawer(OFF_LATTICE);
    render(<GridAlignmentControls />);
    expect(screen.getByTestId('grid-alignment-hint')).toHaveTextContent(
      'drawerShape.gridAlignment.hint:{"x":"+32","y":"+32"}'
    );
  });

  // The stored value is exact (roundMm keeps 2 decimals) — it was only
  // the two readouts that disagreed, the stepper rounding 0.75 up to "0.8" and
  // the hint rounding the negated frame shift down to "−0.7".
  it('commits a typed two-decimal shift at full precision', () => {
    setDrawer(REGISTERED);
    render(<GridAlignmentControls />);
    const input = screen.getByLabelText('drawerShape.gridAlignment.shiftY');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '0.75' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockUpdateDrawer).toHaveBeenCalledWith({ gridShiftY: 0.75 });
  });

  it('displays a stored two-decimal shift exactly, in both the field and the hint', () => {
    setDrawer(REGISTERED, { gridShiftY: 0.75 });
    render(<GridAlignmentControls />);
    expect(screen.getByLabelText('drawerShape.gridAlignment.shiftY')).toHaveValue(0.75);
    // A registered shape has zero registration, so the frame shift is exactly
    // the negated manual shift — and must read as −0.75, not −0.7.
    expect(screen.getByTestId('grid-alignment-hint')).toHaveTextContent(
      'drawerShape.gridAlignment.hint:{"x":"+0","y":"−0.75"}'
    );
  });

  it('hides the hint for an already-registered shape', () => {
    setDrawer(REGISTERED);
    render(<GridAlignmentControls />);
    expect(screen.queryByTestId('grid-alignment-hint')).toBeNull();
  });

  it('steps the X shift by 0.5mm through the drawer command', () => {
    setDrawer(OFF_LATTICE);
    render(<GridAlignmentControls />);
    fireEvent.click(
      screen.getByLabelText(
        'drawerShape.gridAlignment.increase:{"label":"drawerShape.gridAlignment.shiftX"}'
      )
    );
    expect(mockUpdateDrawer).toHaveBeenCalledWith({ gridShiftX: 0.5 });
  });

  it('clamps an out-of-range stored shift for display', () => {
    // Imported/hand-edited layouts can carry shifts beyond ±pitch/2; the
    // frame clamps them for geometry, so the control must show the same.
    setDrawer(OFF_LATTICE, { gridShiftX: 30 });
    render(<GridAlignmentControls />);
    expect(screen.getByLabelText('drawerShape.gridAlignment.shiftX')).toHaveValue(U / 2);
  });

  it('clamps a typed value to half the grid pitch', () => {
    setDrawer(OFF_LATTICE);
    render(<GridAlignmentControls />);
    const input = screen.getByLabelText('drawerShape.gridAlignment.shiftY');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '100' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockUpdateDrawer).toHaveBeenCalledWith({ gridShiftY: U / 2 });
  });

  it('offers reset only when a manual shift is set, and zeroes both axes', () => {
    setDrawer(OFF_LATTICE);
    const { rerender } = render(<GridAlignmentControls />);
    expect(
      screen.queryByRole('button', { name: 'drawerShape.gridAlignment.reset' })
    ).not.toBeInTheDocument();

    setDrawer(OFF_LATTICE, { gridShiftX: 3 });
    rerender(<GridAlignmentControls />);
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.gridAlignment.reset' }));
    expect(mockUpdateDrawer).toHaveBeenCalledWith({ gridShiftX: 0, gridShiftY: 0 });
  });
});
