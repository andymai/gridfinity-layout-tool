import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WallsSection } from './WallsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('WallsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders wall thickness slider', () => {
    const { container } = render(<WallsSection />);
    expect(container.querySelector('div[role="slider"]')).toBeInTheDocument();
  });

  it('renders pattern selector with all options', () => {
    render(<WallsSection />);
    expect(screen.getByText('Wall pattern')).toBeInTheDocument();
    expect(screen.getByText('Solid')).toBeInTheDocument();
    expect(screen.getByText('Honeycomb')).toBeInTheDocument();
  });

  it('shows partial slot note when some walls slotted and pattern enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        wallPattern: { enabled: true, pattern: 'honeycomb' as const },
        style: 'slotted',
        slotConfig: {
          ...DEFAULT_BIN_PARAMS.slotConfig,
          x: { enabled: true, pitch: 20 },
          y: { enabled: false, pitch: 20 },
        },
      },
    });

    render(<WallsSection />);
    expect(screen.getByText('Walls with divider slots will keep solid walls')).toBeInTheDocument();
  });

  it('renders with honeycomb pattern selected', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        wallPattern: { enabled: true, pattern: 'honeycomb' as const },
      },
    });

    render(<WallsSection />);
    const select = screen.getByRole('combobox');
    expect(select.value).toBe('honeycomb');
  });
});
