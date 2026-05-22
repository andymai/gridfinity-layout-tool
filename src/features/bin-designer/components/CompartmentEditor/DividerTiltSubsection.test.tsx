import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DividerTiltSubsection } from './DividerTiltSubsection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { resetAllStores } from '@/test/testUtils';

describe('DividerTiltSubsection', () => {
  beforeEach(() => {
    resetAllStores();
    useDesignerStore.setState((s) => ({
      params: DEFAULT_BIN_PARAMS,
      ui: { ...s.ui, selectedDividerKey: null, hoveredDividerKey: null },
    }));
  });

  const setGrid = (cols: number, rows: number): void => {
    const cells = Array.from({ length: cols * rows }, (_, i) => i);
    useDesignerStore.setState((s) => ({
      params: { ...s.params, compartments: { ...s.params.compartments, cols, rows, cells } },
    }));
  };

  it('renders nothing when no interior dividers exist', () => {
    const { container } = render(<DividerTiltSubsection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the empty state when interior dividers exist but none are tilted', () => {
    setGrid(1, 2);
    render(<DividerTiltSubsection />);
    expect(screen.getByText('Diagonal dividers')).toBeInTheDocument();
    expect(
      screen.getByText(/Tilt dividers diagonally for angled compartments/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Click a divider on the canvas to start/i)).toBeInTheDocument();
  });

  it('shows the info popover when the help button is clicked', () => {
    setGrid(1, 2);
    render(<DividerTiltSubsection />);
    fireEvent.click(screen.getByLabelText(/about diagonal dividers/i));
    expect(
      screen.getByText(/Tilt interior walls to create wedge-shaped compartments/i)
    ).toBeInTheDocument();
  });

  it('lists only the modified dividers (not every eligible pair)', () => {
    setGrid(2, 2); // 4 cells = 4 eligible dividers
    useDesignerStore.getState().setDividerOverride(0, 1, 5, -5);
    render(<DividerTiltSubsection />);
    // Only the modified pair renders as a row.
    const rows = screen.getAllByRole('button', { name: /Edit divider between Comp/i });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAccessibleName(/Edit divider between Comp 1 and Comp 2/);
  });

  it('clicking a modified row opens the inspector with Top/Bottom labels for a vertical divider', () => {
    setGrid(2, 1); // two compartments side-by-side → vertical divider between them
    useDesignerStore.getState().setDividerOverride(0, 1, 4, -4);
    render(<DividerTiltSubsection />);
    fireEvent.click(screen.getByRole('button', { name: /Edit divider between Comp/i }));
    // Inspector axis label.
    expect(screen.getByText('Vertical divider')).toBeInTheDocument();
    // Top/Bottom endpoint stepper labels.
    expect(screen.getByRole('spinbutton', { name: /Bottom/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /Top/i })).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: /Left|Right/i })).not.toBeInTheDocument();
  });

  it('inspector shows Left/Right labels for a horizontal divider', () => {
    setGrid(1, 2); // two compartments stacked → horizontal divider between them
    useDesignerStore.getState().setDividerOverride(0, 1, 3, -3);
    render(<DividerTiltSubsection />);
    fireEvent.click(screen.getByRole('button', { name: /Edit divider between Comp/i }));
    expect(screen.getByText('Horizontal divider')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /Left/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /Right/i })).toBeInTheDocument();
  });

  it('Back button returns from inspector to the modified list', () => {
    setGrid(1, 2);
    useDesignerStore.getState().setDividerOverride(0, 1, 4, -4);
    render(<DividerTiltSubsection />);
    fireEvent.click(screen.getByRole('button', { name: /Edit divider between Comp/i }));
    expect(screen.getByRole('button', { name: /^back$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    // After back, modified row should be visible again.
    expect(screen.getByRole('button', { name: /Edit divider between Comp/i })).toBeInTheDocument();
  });

  it('Reset to straight from inspector removes the override and stays in inspector', () => {
    setGrid(1, 2);
    useDesignerStore.getState().setDividerOverride(0, 1, 7, -7);
    render(<DividerTiltSubsection />);
    fireEvent.click(screen.getByRole('button', { name: /Edit divider between Comp/i }));
    fireEvent.click(screen.getByRole('button', { name: /Reset to straight/i }));
    expect(useDesignerStore.getState().params.compartments.dividerOverrides).toBeUndefined();
    // Inspector stays open with steppers at 0.
    expect(screen.getByText('Horizontal divider')).toBeInTheDocument();
  });

  it('removing a tilt via the row ✕ button drops just that override', () => {
    setGrid(2, 2);
    useDesignerStore.getState().setDividerOverride(0, 1, 5, -5);
    useDesignerStore.getState().setDividerOverride(2, 3, 6, -6);
    render(<DividerTiltSubsection />);
    const removeButtons = screen.getAllByRole('button', { name: /Reset divider to straight/i });
    fireEvent.click(removeButtons[0]);
    const remaining = useDesignerStore.getState().params.compartments.dividerOverrides;
    expect(remaining).toHaveLength(1);
    expect(remaining?.[0]).toMatchObject({ compartmentA: 2, compartmentB: 3 });
  });

  it('Reset all clears every override and only renders when any exist', async () => {
    setGrid(1, 2);
    render(<DividerTiltSubsection />);
    expect(screen.queryByRole('button', { name: /^reset all$/i })).not.toBeInTheDocument();
    useDesignerStore.getState().setDividerOverride(0, 1, 8, -8);
    // Zustand subscription rerenders are async under the testing-library
    // batched scheduler — `findByRole` waits past the next render frame.
    const resetBtn = await screen.findByRole('button', { name: /^reset all$/i });
    fireEvent.click(resetBtn);
    expect(useDesignerStore.getState().params.compartments.dividerOverrides).toBeUndefined();
  });

  it('the empty-state diagram renders without compartment text fragments', () => {
    setGrid(1, 2);
    const { container } = render(<DividerTiltSubsection />);
    // SVG diagram should be present in the empty state.
    expect(container.querySelector('svg')).not.toBeNull();
    // No row-label text should appear when no overrides exist.
    expect(screen.queryByText(/Comp 1 ↔ Comp 2/)).toBeNull();
  });

  it('two steppers (start/end) are always shown — no asymmetric toggle exists', () => {
    setGrid(2, 1);
    useDesignerStore.getState().setDividerOverride(0, 1, 6, -6);
    render(<DividerTiltSubsection />);
    fireEvent.click(screen.getByRole('button', { name: /Edit divider between Comp/i }));
    // Two steppers always present.
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
    // No "Asymmetric" toggle anywhere.
    expect(screen.queryByLabelText(/asymmetric/i)).not.toBeInTheDocument();
  });

  it('removing the hovered row clears hoveredDividerKey so the highlight does not stick', () => {
    setGrid(1, 2);
    useDesignerStore.getState().setDividerOverride(0, 1, 4, -4);
    render(<DividerTiltSubsection />);
    const row = screen.getByRole('button', { name: /Edit divider between Comp/i });
    fireEvent.pointerEnter(row.parentElement!);
    expect(useDesignerStore.getState().ui.hoveredDividerKey).toBe('0-1');
    fireEvent.click(screen.getByRole('button', { name: /Reset divider to straight/i }));
    expect(useDesignerStore.getState().ui.hoveredDividerKey).toBeNull();
  });

  it('Reset all also clears hoveredDividerKey', async () => {
    setGrid(1, 2);
    useDesignerStore.getState().setDividerOverride(0, 1, 4, -4);
    useDesignerStore.setState((s) => ({ ui: { ...s.ui, hoveredDividerKey: '0-1' } }));
    render(<DividerTiltSubsection />);
    const resetBtn = await screen.findByRole('button', { name: /^reset all$/i });
    fireEvent.click(resetBtn);
    expect(useDesignerStore.getState().ui.hoveredDividerKey).toBeNull();
    expect(useDesignerStore.getState().ui.selectedDividerKey).toBeNull();
  });

  it('mini-diagram renders inside each modified row', () => {
    setGrid(2, 1);
    useDesignerStore.getState().setDividerOverride(0, 1, 3, -3);
    const { container } = render(<DividerTiltSubsection />);
    const row = within(screen.getByRole('button', { name: /Edit divider between Comp/i }));
    expect(row.queryByText('Diagonal dividers')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
