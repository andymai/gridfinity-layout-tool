import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DividerTiltSubsection } from './DividerTiltSubsection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { resetAllStores } from '@/test/testUtils';

describe('DividerTiltSubsection', () => {
  beforeEach(() => {
    resetAllStores();
    useDesignerStore.setState({ params: DEFAULT_BIN_PARAMS });
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

  it('renders a row per eligible divider', () => {
    setGrid(1, 2);
    render(<DividerTiltSubsection />);
    expect(screen.getByText('Diagonal dividers')).toBeInTheDocument();
    expect(screen.getByText(/Comp 1 ↔ Comp 2/)).toBeInTheDocument();
  });

  it('shows Straight summary when no override is set', () => {
    setGrid(1, 2);
    render(<DividerTiltSubsection />);
    expect(screen.getByText('Straight')).toBeInTheDocument();
  });

  it('expanding a row reveals the symmetric tilt stepper', () => {
    setGrid(1, 2);
    render(<DividerTiltSubsection />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByRole('spinbutton', { name: /tilt \(mm\)/i })).toBeInTheDocument();
  });

  it('toggling Asymmetric exposes start/end controls without breaking symmetric data', () => {
    setGrid(1, 2);
    useDesignerStore.getState().setDividerOverride(0, 1, 10, -10);
    render(<DividerTiltSubsection />);
    // Row already shows tilted state in summary; expand to access controls.
    fireEvent.click(screen.getByRole('button', { name: /Comp 1 ↔ Comp 2/ }));
    // Symmetric view by default (mirrored data) — single Tilt stepper.
    expect(screen.queryByRole('spinbutton', { name: /start \(mm\)/i })).not.toBeInTheDocument();
    // Toggle Asymmetric on.
    fireEvent.click(screen.getByLabelText(/asymmetric/i));
    expect(screen.getByRole('spinbutton', { name: /start \(mm\)/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /end \(mm\)/i })).toBeInTheDocument();
    // Data shape is unchanged (still mirrored).
    const override = useDesignerStore
      .getState()
      .params.compartments.dividerOverrides?.find((o) => o.compartmentA === 0);
    expect(override).toEqual({ compartmentA: 0, compartmentB: 1, offsetStart: 10, offsetEnd: -10 });
  });

  it('Reset all clears every override but only renders when any exist', async () => {
    setGrid(1, 2);
    render(<DividerTiltSubsection />);
    expect(screen.queryByRole('button', { name: /^reset all$/i })).not.toBeInTheDocument();
    useDesignerStore.getState().setDividerOverride(0, 1, 8, -8);
    const resetBtn = await screen.findByRole('button', { name: /^reset all$/i });
    fireEvent.click(resetBtn);
    expect(useDesignerStore.getState().params.compartments.dividerOverrides).toBeUndefined();
  });

  it('renders a mini SVG diagram per row', () => {
    setGrid(2, 1);
    const { container } = render(<DividerTiltSubsection />);
    const row = within(screen.getByRole('button', { name: /Comp 1 ↔ Comp 2/ }));
    // The button contains the inline SVG.
    expect(row.queryByText('Diagonal dividers')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
