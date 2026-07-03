import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { PhysicalUnitsSection } from './PhysicalUnitsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import { helpJumpEventName } from '@/shared/help/helpJumpDispatcher';

describe('PhysicalUnitsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders a single grid unit field by default (square grid)', () => {
    // DEFAULT_BIN_PARAMS has gridUnitMmY undefined (square): one shared field,
    // no separate Y input until non-square mode is enabled.
    expect(useDesignerStore.getState().params.gridUnitMmY).toBeUndefined();
    render(<PhysicalUnitsSection />);
    expect(screen.getByLabelText('Grid unit')).toBeInTheDocument();
    expect(screen.queryByLabelText('Grid unit Y')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Height unit')).toBeInTheDocument();
  });

  it('reveals independent X and Y fields in non-square mode, Y seeded from X', () => {
    // Non-square mode is marked by a concrete gridUnitMmY (here equal to X, 42mm).
    act(() => {
      useDesignerStore.setState((s) => ({ params: { ...s.params, gridUnitMmY: 42 } }));
    });
    render(<PhysicalUnitsSection />);
    // X input keeps the 'Grid unit' accessible name; Y is its own field.
    expect(screen.getByLabelText('Grid unit')).toHaveValue(42);
    expect(screen.getByLabelText('Grid unit Y')).toHaveValue(42);
  });

  it('shows distinct X and Y values when grid is non-square (X=42mm, Y=40mm)', () => {
    act(() => {
      useDesignerStore.setState((s) => ({ params: { ...s.params, gridUnitMmY: 40 } }));
    });
    render(<PhysicalUnitsSection />);
    expect(screen.getByLabelText('Grid unit')).toHaveValue(42);
    expect(screen.getByLabelText('Grid unit Y')).toHaveValue(40);
  });

  it('renders print bed width input (linked by default)', () => {
    render(<PhysicalUnitsSection />);
    expect(screen.getByLabelText('Print bed width')).toBeInTheDocument();
  });

  it('expands when a help-jump targets binDesigner:base so the print-bed marker is reachable', () => {
    render(<PhysicalUnitsSection />);
    const toggle = screen.getByRole('button', { name: /physical units/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    act(() => {
      window.dispatchEvent(new CustomEvent(helpJumpEventName('binDesigner:base')));
    });

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
