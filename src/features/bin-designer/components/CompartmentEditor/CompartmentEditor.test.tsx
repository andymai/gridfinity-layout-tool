import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store/settings';
import { DEFAULT_BIN_PARAMS, DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { getInteriorDims } from '@/features/bin-designer/utils/dividerAngle';
import {
  formatCompactMm,
  minUniformCavity,
  solveCountForMinCavity,
} from '@/features/bin-designer/utils/compartmentDimensions';
import { CompartmentEditor } from './CompartmentEditor';

const TWO_BY_TWO = {
  ...DEFAULT_BIN_PARAMS,
  compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 2, rows: 2, cells: [0, 1, 2, 3] },
};

/** Interior dimensions for the default bin, used to predict solver output. */
const interior = getInteriorDims({
  width: DEFAULT_BIN_PARAMS.width,
  depth: DEFAULT_BIN_PARAMS.depth,
  gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm,
  wallThickness: DEFAULT_BIN_PARAMS.wallThickness,
});
const { thickness } = DEFAULT_BIN_PARAMS.compartments;

describe('CompartmentEditor', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    useDesignerStore.setState({
      params: DEFAULT_BIN_PARAMS,
    });
  });

  it('renders the unified sizing panel', () => {
    render(<CompartmentEditor />);
    expect(screen.getByText(/smallest opening/i)).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /columns/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /rows/i })).toBeInTheDocument();
  });

  it('has no By count / By size mode toggle', () => {
    render(<CompartmentEditor />);
    expect(screen.queryByRole('button', { name: /^by count$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^by size$/i })).toBeNull();
  });

  it('shows size inputs and grid steppers together (width, depth, columns, rows)', () => {
    render(<CompartmentEditor />);
    // Default 1x1 grid: no 2D editor, no divider-height control — exactly four
    // numeric inputs: width, depth, columns, rows.
    expect(screen.getByRole('spinbutton', { name: /width/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /depth/i })).toBeInTheDocument();
    expect(screen.getAllByRole('spinbutton')).toHaveLength(4);
  });

  it('width field shows the achieved smallest opening, not a stale target', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 2, rows: 1, cells: [0, 1] },
      },
    });
    render(<CompartmentEditor />);
    const expected = formatCompactMm(minUniformCavity(interior.innerW, 2, thickness));
    expect(screen.getByRole('spinbutton', { name: /width/i })).toHaveValue(Number(expected));
  });

  it('typing a min width snaps the column count via the fit-guarantee solver', () => {
    const setCompartmentGrid = vi.fn();
    useDesignerStore.setState({ params: DEFAULT_BIN_PARAMS, setCompartmentGrid });
    render(<CompartmentEditor />);

    const widthInput = screen.getByRole('spinbutton', { name: /width/i });
    fireEvent.change(widthInput, { target: { value: '20' } });
    fireEvent.blur(widthInput);

    const expectedCols = solveCountForMinCavity(
      interior.innerW,
      thickness,
      20,
      DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_GRID,
      DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID
    );
    expect(setCompartmentGrid).toHaveBeenCalledWith(
      expectedCols,
      DEFAULT_BIN_PARAMS.compartments.rows
    );
  });

  it('typing a width at least the full interior collapses to a single column', () => {
    const setCompartmentGrid = vi.fn();
    useDesignerStore.setState({ params: DEFAULT_BIN_PARAMS, setCompartmentGrid });
    render(<CompartmentEditor />);

    const widthInput = screen.getByRole('spinbutton', { name: /width/i });
    fireEvent.change(widthInput, { target: { value: String(Math.round(interior.innerW)) } });
    fireEvent.blur(widthInput);

    expect(setCompartmentGrid).toHaveBeenCalledWith(1, DEFAULT_BIN_PARAMS.compartments.rows);
  });

  it('updates columns when the grid stepper changes', () => {
    const setCompartmentGrid = vi.fn();
    useDesignerStore.setState({ params: DEFAULT_BIN_PARAMS, setCompartmentGrid });
    render(<CompartmentEditor />);
    const cols = screen.getByRole('spinbutton', { name: /columns/i });
    fireEvent.change(cols, { target: { value: '3' } });
    fireEvent.blur(cols);
    expect(setCompartmentGrid).toHaveBeenCalledWith(3, DEFAULT_BIN_PARAMS.compartments.rows);
  });

  it('shows the tile-evenly explanation caption', () => {
    render(<CompartmentEditor />);
    expect(screen.getByText(/tile the bin evenly/i)).toBeInTheDocument();
  });

  it('shows 2D grid editor when grid is larger than 1x1', () => {
    useDesignerStore.setState({ params: TWO_BY_TWO });
    render(<CompartmentEditor />);
    expect(screen.getByRole('application')).toBeInTheDocument();
  });

  it('does not show 2D grid editor when grid is 1x1', () => {
    render(<CompartmentEditor />);
    expect(screen.queryByRole('application')).not.toBeInTheDocument();
  });

  it('shows wall thickness control when compartments > 1', () => {
    useDesignerStore.setState({ params: TWO_BY_TWO });
    render(<CompartmentEditor />);
    expect(screen.getByText(/wall thickness/i)).toBeInTheDocument();
  });

  it('shows instruction text for grid interaction', () => {
    useDesignerStore.setState({ params: TWO_BY_TWO });
    render(<CompartmentEditor />);
    expect(screen.getByText(/drag to merge/i)).toBeInTheDocument();
  });

  it('hides the angled-divider hit targets until the feature is opted into', () => {
    useDesignerStore.setState({ params: TWO_BY_TWO });
    render(<CompartmentEditor />);
    expect(screen.queryByRole('button', { name: /Edit divider between Comp/i })).toBeNull();
  });

  it('renders the angled-divider hit targets once the feature is enabled', () => {
    useSettingsStore.getState().updateSetting('angledDividersEnabled', true);
    useDesignerStore.setState({ params: TWO_BY_TWO });
    render(<CompartmentEditor />);
    expect(
      screen.getAllByRole('button', { name: /Edit divider between Comp/i }).length
    ).toBeGreaterThan(0);
  });

  it('shows reset button when compartments are merged', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        compartments: {
          ...DEFAULT_BIN_PARAMS.compartments,
          cols: 2,
          rows: 2,
          cells: [0, 0, 1, 1],
        },
      },
    });
    render(<CompartmentEditor />);
    expect(screen.getByText(/reset/i)).toBeInTheDocument();
  });
});
