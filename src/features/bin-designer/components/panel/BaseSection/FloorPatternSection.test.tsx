import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FloorPatternSection } from './FloorPatternSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('FloorPatternSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('toggles drainage on', () => {
    render(<FloorPatternSection />);
    fireEvent.click(screen.getByRole('switch', { name: 'Drainage holes' }));
    expect(useDesignerStore.getState().params.floorPattern?.enabled).toBe(true);
  });

  it('reveals the hole picker only once drainage is on', () => {
    const { unmount } = render(<FloorPatternSection />);
    expect(screen.queryByLabelText('Hole shape')).not.toBeInTheDocument();
    unmount();

    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        floorPattern: { enabled: true, pattern: 'round', scale: 0.5 },
      },
    });
    render(<FloorPatternSection />);

    expect(screen.getByLabelText('Hole shape')).toBeInTheDocument();
  });

  it('disables drainage holes on a lightweight floor', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, lightweight: true },
      },
    });

    render(<FloorPatternSection />);

    expect(screen.getByRole('switch', { name: 'Drainage holes' })).toBeDisabled();
  });

  it('names the family instead of rendering controls when the body has no floor', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, base: { ...DEFAULT_BIN_PARAMS.base, spacer: true } },
    });
    render(<FloorPatternSection />);
    expect(screen.queryByRole('switch', { name: 'Drainage holes' })).not.toBeInTheDocument();
  });
});
