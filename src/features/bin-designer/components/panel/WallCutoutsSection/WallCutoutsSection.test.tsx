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

  it('shows side chips and controls when enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
      },
    });

    render(<WallCutoutsSection />);
    // Toggle chips visible (active sides appear twice: chip + section header)
    expect(screen.getAllByText('Left').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Right').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Front')).toBeDefined();
    expect(screen.getByText('Back')).toBeDefined();
    expect(screen.getByText('Interior walls')).toBeDefined();

    // Span/Height labels visible (L/R are enabled by default)
    const spanElements = screen.getAllByText('Span');
    expect(spanElements.length).toBeGreaterThanOrEqual(1);
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
    expect(screen.queryByText('Left')).toBeNull();
  });

  it('renders shape selector buttons when enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
      },
    });

    render(<WallCutoutsSection />);
    expect(screen.getByText('U-Shape')).toBeDefined();
    expect(screen.getByText('Scoop')).toBeDefined();
    expect(screen.getByText('Funnel')).toBeDefined();
  });
});
