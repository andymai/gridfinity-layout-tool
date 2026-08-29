import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { PhysicalUnitsSection } from './PhysicalUnitsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('PhysicalUnitsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders a single linked grid unit field by default (square grid)', () => {
    // DEFAULT_BIN_PARAMS has gridUnitMmY undefined (square): one linked field,
    // no separate Y input until the pitches are unlinked.
    expect(useDesignerStore.getState().params.gridUnitMmY).toBeUndefined();
    render(<PhysicalUnitsSection />);
    expect(screen.getByLabelText('Grid unit X')).toBeInTheDocument();
    expect(screen.queryByLabelText('Grid unit Y')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Height unit')).toBeInTheDocument();
  });

  it('renders linked (single field) when the stored Y pitch equals X', () => {
    // A Y override equal to X is visually square: the linked control collapses
    // it to one field, same as the print bed's linked pair.
    act(() => {
      useDesignerStore.setState((s) => ({ params: { ...s.params, gridUnitMmY: 42 } }));
    });
    render(<PhysicalUnitsSection />);
    expect(screen.getByLabelText('Grid unit X')).toHaveValue(42);
    expect(screen.queryByLabelText('Grid unit Y')).not.toBeInTheDocument();
  });

  it('shows distinct X and Y values when grid is non-square (X=42mm, Y=40mm)', () => {
    act(() => {
      useDesignerStore.setState((s) => ({ params: { ...s.params, gridUnitMmY: 40 } }));
    });
    render(<PhysicalUnitsSection />);
    expect(screen.getByLabelText('Grid unit X')).toHaveValue(42);
    expect(screen.getByLabelText('Grid unit Y')).toHaveValue(40);
  });

  it('renders print bed width input (linked by default)', () => {
    render(<PhysicalUnitsSection />);
    expect(screen.getByLabelText('Print bed width')).toBeInTheDocument();
  });

  it('expands when a help-jump targets its section so the print-bed marker is reachable', () => {
    render(
      <div data-help-target="bd-physical-units">
        <PhysicalUnitsSection />
      </div>
    );
    const toggle = screen.getByRole('button', { name: /physical units/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    act(() => {
      window.dispatchEvent(
        new CustomEvent('help-jump:any', { detail: { controlId: 'bd-physical-units' } })
      );
    });

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
