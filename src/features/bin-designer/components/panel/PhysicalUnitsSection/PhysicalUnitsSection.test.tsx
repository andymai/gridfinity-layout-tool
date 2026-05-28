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

  it('renders unit inputs', () => {
    render(<PhysicalUnitsSection />);
    expect(screen.getByLabelText('Grid unit')).toBeInTheDocument();
    expect(screen.getByLabelText('Height unit')).toBeInTheDocument();
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
