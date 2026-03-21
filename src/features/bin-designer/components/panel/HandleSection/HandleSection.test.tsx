import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HandleSection } from './HandleSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('HandleSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders handles toggle', () => {
    render(<HandleSection />);
    const labels = screen.getAllByText('Handles');
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it('shows side chips and controls when enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        handles: { ...DEFAULT_BIN_PARAMS.handles, enabled: true },
      },
    });

    render(<HandleSection />);
    expect(screen.getByText('Front')).toBeDefined();
    expect(screen.getByText('Back')).toBeDefined();
    expect(screen.getByText('Left')).toBeDefined();
    expect(screen.getByText('Right')).toBeDefined();
  });

  it('does not show controls when disabled', () => {
    render(<HandleSection />);
    expect(screen.queryByText('Front')).toBeNull();
  });

  it('shows disabled reason for slotted bins', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, style: 'slotted' },
    });

    render(<HandleSection />);
    expect(screen.getByText(/Not available/)).toBeDefined();
  });

  it('shows disabled reason for solid bins', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, style: 'solid' },
    });

    render(<HandleSection />);
    expect(screen.getByText(/Not available/)).toBeDefined();
  });
});
