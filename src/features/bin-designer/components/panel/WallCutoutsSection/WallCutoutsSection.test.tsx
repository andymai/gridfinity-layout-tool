import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WallCutoutsSection } from './WallCutoutsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('WallCutoutsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders wall cutouts toggle', () => {
    render(<WallCutoutsSection />);
    const labels = screen.getAllByText('Wall Cutouts');
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it('shows controls when enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
      },
    });

    render(<WallCutoutsSection />);
    const widthElements = screen.getAllByText('Width');
    expect(widthElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows per-side toggles when enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
      },
    });

    render(<WallCutoutsSection />);
    expect(screen.getByText('Front')).toBeDefined();
    expect(screen.getByText('Back')).toBeDefined();
    expect(screen.getByText('Left')).toBeDefined();
    expect(screen.getByText('Right')).toBeDefined();
    expect(screen.getByText('Interior walls')).toBeDefined();
  });

  it('shows disabled reason for solid bins', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, style: 'solid' },
    });

    render(<WallCutoutsSection />);
    expect(screen.getByText(/Not available/)).toBeDefined();
  });

  it('does not show controls when disabled', () => {
    render(<WallCutoutsSection />);
    expect(screen.queryByText('Front')).toBeNull();
  });
});
