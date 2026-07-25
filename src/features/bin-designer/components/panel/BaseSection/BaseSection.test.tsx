import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BaseSection } from './BaseSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('BaseSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders base toggles', () => {
    render(<BaseSection />);
    expect(screen.getByText('Magnet holes')).toBeInTheDocument();
    expect(screen.getByText('Screw holes')).toBeInTheDocument();
    expect(screen.getByText('Stacking lip')).toBeInTheDocument();
    expect(screen.getByText('Flat base (no socket)')).toBeInTheDocument();
    expect(screen.getByText('Lightweight floor')).toBeInTheDocument();
    expect(screen.getByText('Drainage holes')).toBeInTheDocument();
  });

  it('reveals the hole picker only once drainage is on', () => {
    const { unmount } = render(<BaseSection />);
    expect(screen.queryByLabelText('Hole shape')).not.toBeInTheDocument();
    unmount();

    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        floorPattern: { enabled: true, pattern: 'round', scale: 0.5 },
      },
    });
    render(<BaseSection />);
    expect(screen.getByLabelText('Hole shape')).toBeInTheDocument();
  });

  it('disables drainage holes on a lightweight floor', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, lightweight: true },
      },
    });

    render(<BaseSection />);
    expect(screen.getByRole('switch', { name: 'Drainage holes' })).toBeDisabled();
  });

  it('disables magnet and screw toggles when flat floor is active', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
      },
    });

    render(<BaseSection />);

    const magnetToggle = screen.getByRole('switch', { name: 'Magnet holes' });
    const screwToggle = screen.getByRole('switch', { name: 'Screw holes' });

    expect(magnetToggle).toBeDisabled();
    expect(screwToggle).toBeDisabled();
  });
});
