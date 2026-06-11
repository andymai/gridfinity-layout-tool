import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store/settings';
import { DEFAULT_BIN_PARAMS, DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { getInteriorDims } from '@/features/bin-designer/utils/dividerAngle';
import {
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

  it('renders the grid steppers as the primary control', () => {
    render(<CompartmentEditor />);
    expect(screen.getByText(/columns/i)).toBeInTheDocument();
    expect(screen.getByText(/rows/i)).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /columns/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /rows/i })).toBeInTheDocument();
  });

  it('always shows the resulting compartment size without hovering or expanding', () => {
    useDesignerStore.setState({ params: TWO_BY_TWO });
    render(<CompartmentEditor />);
    const w = Math.round(minUniformCavity(interior.innerW, 2, thickness) * 10) / 10;
    const d = Math.round(minUniformCavity(interior.innerD, 2, thickness) * 10) / 10;
    const readout = screen.getByText(/≈/);
    expect(readout.textContent).toContain(String(w));
    expect(readout.textContent).toContain(String(d));
    expect(readout.textContent).toMatch(/mm/);
  });

  it('surfaces the grid-cap hint in the readout when an axis hits the max grid', () => {
    const max = DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID;
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        compartments: {
          ...DEFAULT_BIN_PARAMS.compartments,
          cols: max,
          rows: 1,
          cells: Array.from({ length: max }, (_, i) => i),
        },
      },
    });
    render(<CompartmentEditor />);
    const readout = screen.getByText(/≈/);
    expect(readout.textContent).toContain(`Max ${max} per side`);
  });

  it('has no By count / By size mode toggle', () => {
    render(<CompartmentEditor />);
    expect(screen.queryByRole('button', { name: /^by count$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^by size$/i })).toBeNull();
  });

  it('keeps manual sizing collapsed as an advanced option by default', () => {
    render(<CompartmentEditor />);
    expect(screen.getByRole('button', { name: /set by size/i })).toBeInTheDocument();
    // The mm size inputs are not rendered until the user opts in.
    expect(screen.queryByRole('spinbutton', { name: /width \(mm\)/i })).toBeNull();
    expect(screen.queryByRole('spinbutton', { name: /depth \(mm\)/i })).toBeNull();
  });

  it('reveals the mm size inputs when "Set by size" is expanded', () => {
    render(<CompartmentEditor />);
    fireEvent.click(screen.getByRole('button', { name: /set by size/i }));
    expect(screen.getByRole('spinbutton', { name: /width \(mm\)/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /depth \(mm\)/i })).toBeInTheDocument();
    expect(screen.getByText(/tile the bin evenly/i)).toBeInTheDocument();
  });

  it('typing a min width in the advanced sizer snaps the column count', () => {
    const setCompartmentGrid = vi.fn();
    useDesignerStore.setState({ params: DEFAULT_BIN_PARAMS, setCompartmentGrid });
    render(<CompartmentEditor />);
    fireEvent.click(screen.getByRole('button', { name: /set by size/i }));

    const widthInput = screen.getByRole('spinbutton', { name: /width \(mm\)/i });
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

  it('does not expose accessible names that collide with the bin dimensions', () => {
    // CompartmentEditor renders inside ParameterPanel alongside bin Width/Depth
    // controls; the advanced size inputs must not duplicate those names.
    render(<CompartmentEditor />);
    fireEvent.click(screen.getByRole('button', { name: /set by size/i }));
    expect(screen.queryByLabelText('Width')).toBeNull();
    expect(screen.queryByLabelText('Depth')).toBeNull();
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
