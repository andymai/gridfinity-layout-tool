import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DividerTiltSubsection } from './DividerTiltSubsection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { resetAllStores } from '@/test/testUtils';

describe('DividerTiltSubsection', () => {
  beforeEach(() => {
    resetAllStores();
    useDesignerStore.setState((s) => ({
      params: DEFAULT_BIN_PARAMS,
      ui: { ...s.ui, selectedDividerKey: null, hoveredDividerKey: null, dividerTiltPreview: null },
    }));
  });

  const setGrid = (cols: number, rows: number): void => {
    const cells = Array.from({ length: cols * rows }, (_, i) => i);
    useDesignerStore.setState((s) => ({
      params: { ...s.params, compartments: { ...s.params.compartments, cols, rows, cells } },
    }));
  };

  const openInspector = (): void => {
    fireEvent.click(screen.getByRole('button', { name: /Edit divider between Comp/i }));
  };

  it('renders nothing when no interior dividers exist', () => {
    const { container } = render(<DividerTiltSubsection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists every eligible divider, not just the modified ones', () => {
    setGrid(2, 2); // 4 cells → 4 eligible dividers
    render(<DividerTiltSubsection />);
    const rows = screen.getAllByRole('button', { name: /Edit divider between Comp/i });
    expect(rows).toHaveLength(4);
  });

  it('shows the info popover when the help button is clicked', () => {
    setGrid(1, 2);
    render(<DividerTiltSubsection />);
    fireEvent.click(screen.getByLabelText(/about diagonal dividers/i));
    expect(
      screen.getByText(/Tilt interior walls to create wedge-shaped compartments/i)
    ).toBeInTheDocument();
  });

  it('opens the inspector with an angle slider and stepper (no endpoint offsets)', () => {
    setGrid(2, 1); // side-by-side → vertical divider
    render(<DividerTiltSubsection />);
    openInspector();
    expect(screen.getByText('Vertical divider')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /angle/i })).toBeInTheDocument();
    // Angle is the only visible numeric field (Shift lives in the collapsed Fine-tune).
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1);
    expect(screen.queryByRole('spinbutton', { name: /Top|Bottom|Left|Right/i })).toBeNull();
  });

  it('clicking a preset commits a tilt for the selected divider', () => {
    setGrid(2, 1);
    render(<DividerTiltSubsection />);
    openInspector();
    fireEvent.click(screen.getByRole('button', { name: '45°' }));
    const overrides = useDesignerStore.getState().params.compartments.dividerOverrides;
    expect(overrides).toHaveLength(1);
    // A positive angle pivots about centre → end > start.
    expect(overrides?.[0].offsetEnd).toBeGreaterThan(overrides?.[0].offsetStart ?? 0);
  });

  it('tilted rows show an angle badge in the list', () => {
    // depth 1u → vertical segment ≈ 39.1mm, so ±19.55mm offsets read as ~45°.
    useDesignerStore.setState((s) => ({ params: { ...s.params, depth: 1 } }));
    setGrid(2, 1);
    useDesignerStore.getState().setDividerOverride(0, 1, -19.55, 19.55);
    render(<DividerTiltSubsection />);
    expect(screen.getByText('45°')).toBeInTheDocument();
  });

  it('Back returns from inspector to the list', () => {
    setGrid(1, 2);
    render(<DividerTiltSubsection />);
    openInspector();
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByRole('button', { name: /Edit divider between Comp/i })).toBeInTheDocument();
  });

  it('Reset to straight removes the override and stays in the inspector', () => {
    setGrid(1, 2);
    useDesignerStore.getState().setDividerOverride(0, 1, 7, -7);
    render(<DividerTiltSubsection />);
    openInspector();
    fireEvent.click(screen.getByRole('button', { name: /Reset to straight/i }));
    expect(useDesignerStore.getState().params.compartments.dividerOverrides).toBeUndefined();
    expect(screen.getByText('Horizontal divider')).toBeInTheDocument();
  });

  it('Reset all clears every override and only renders when any exist', async () => {
    setGrid(1, 2);
    render(<DividerTiltSubsection />);
    expect(screen.queryByRole('button', { name: /^reset all$/i })).not.toBeInTheDocument();
    useDesignerStore.getState().setDividerOverride(0, 1, 8, -8);
    const resetBtn = await screen.findByRole('button', { name: /^reset all$/i });
    fireEvent.click(resetBtn);
    expect(useDesignerStore.getState().params.compartments.dividerOverrides).toBeUndefined();
  });

  it('shows the conflict notice when a tilted divider strips an enabled feature', () => {
    setGrid(2, 1);
    useDesignerStore.setState((s) => ({
      params: { ...s.params, scoop: { ...s.params.scoop, enabled: true } },
    }));
    useDesignerStore.getState().setDividerOverride(0, 1, -10, 10);
    render(<DividerTiltSubsection />);
    openInspector();
    expect(screen.getByText(/removed along tilted dividers/i)).toBeInTheDocument();
  });

  it('hides the conflict notice for a straight divider', () => {
    setGrid(2, 1);
    useDesignerStore.setState((s) => ({
      params: { ...s.params, scoop: { ...s.params.scoop, enabled: true } },
    }));
    render(<DividerTiltSubsection />);
    openInspector();
    expect(screen.queryByText(/removed along tilted dividers/i)).toBeNull();
  });
});
