import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store/settings';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { CompartmentEditor } from './CompartmentEditor';

const TWO_BY_TWO = {
  ...DEFAULT_BIN_PARAMS,
  compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 2, rows: 2, cells: [0, 1, 2, 3] },
};

describe('CompartmentEditor', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    useDesignerStore.setState({
      params: DEFAULT_BIN_PARAMS,
    });
  });

  it('renders without crashing', () => {
    render(<CompartmentEditor />);
    expect(screen.getByText(/columns/i)).toBeInTheDocument();
    expect(screen.getByText(/rows/i)).toBeInTheDocument();
  });

  it('shows grid controls for columns and rows', () => {
    render(<CompartmentEditor />);
    const steppers = screen.getAllByRole('spinbutton');
    expect(steppers.length).toBeGreaterThanOrEqual(2);
  });

  it('shows 2D grid editor when grid is larger than 1x1', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        compartments: {
          ...DEFAULT_BIN_PARAMS.compartments,
          cols: 2,
          rows: 2,
          cells: [0, 1, 2, 3],
        },
      },
    });
    render(<CompartmentEditor />);
    expect(screen.getByRole('application')).toBeInTheDocument();
  });

  it('does not show 2D grid editor when grid is 1x1', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        compartments: {
          ...DEFAULT_BIN_PARAMS.compartments,
          cols: 1,
          rows: 1,
          cells: [0],
        },
      },
    });
    render(<CompartmentEditor />);
    expect(screen.queryByRole('application')).not.toBeInTheDocument();
  });

  it('shows wall thickness control when compartments > 1', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        compartments: {
          ...DEFAULT_BIN_PARAMS.compartments,
          cols: 2,
          rows: 2,
          cells: [0, 1, 2, 3],
        },
      },
    });
    render(<CompartmentEditor />);
    expect(screen.getByText(/wall thickness/i)).toBeInTheDocument();
  });

  it('updates columns when changed', () => {
    const setCompartmentGrid = vi.fn();
    useDesignerStore.setState({
      params: DEFAULT_BIN_PARAMS,
      setCompartmentGrid,
    });
    render(<CompartmentEditor />);
    const steppers = screen.getAllByRole('spinbutton');
    fireEvent.change(steppers[0], { target: { value: '3' } });
    fireEvent.blur(steppers[0]);
    expect(setCompartmentGrid).toHaveBeenCalledWith(3, DEFAULT_BIN_PARAMS.compartments.rows);
  });

  it('shows instruction text for grid interaction', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        compartments: {
          ...DEFAULT_BIN_PARAMS.compartments,
          cols: 2,
          rows: 2,
          cells: [0, 1, 2, 3],
        },
      },
    });
    render(<CompartmentEditor />);
    expect(screen.getByText(/drag to merge/i)).toBeInTheDocument();
  });

  it('hides the angled-divider hit targets until the feature is opted into', () => {
    useDesignerStore.setState({ params: TWO_BY_TWO });
    render(<CompartmentEditor />);
    // Off by default: no on-grid divider hit targets.
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
          cells: [0, 0, 1, 1], // Merged compartments
        },
      },
    });
    render(<CompartmentEditor />);
    expect(screen.getByText(/reset/i)).toBeInTheDocument();
  });
});
