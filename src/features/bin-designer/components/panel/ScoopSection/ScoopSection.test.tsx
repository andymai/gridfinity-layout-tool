import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoopSection } from './ScoopSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('ScoopSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders finger scoop toggle', () => {
    render(<ScoopSection />);
    const labels = screen.getAllByText('Finger scoop');
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it('shows radius controls when enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
      },
    });

    render(<ScoopSection />);
    const radiusElements = screen.getAllByText(/Radius/);
    expect(radiusElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows disabled reason for slotted bins', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, style: 'slotted' },
    });

    render(<ScoopSection />);
    expect(screen.getByText(/Not available/)).toBeDefined();
  });
});
