import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import { ShapeSection } from './ShapeSection';

function toggleOn() {
  fireEvent.click(screen.getByRole('switch', { name: /custom shape/i }));
}

describe('ShapeSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 3, depth: 3 },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders the Custom shape toggle in the off position by default', () => {
    render(<ShapeSection />);
    const sw = screen.getByRole('switch', { name: /custom shape/i });
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('presets and grid are hidden when toggle is off', () => {
    render(<ShapeSection />);
    expect(screen.queryByRole('button', { name: 'L' })).not.toBeInTheDocument();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('flipping the toggle on reveals the L/T/U presets and the grid', () => {
    render(<ShapeSection />);
    toggleOn();
    expect(screen.getByRole('button', { name: 'L' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'T' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'U' })).toBeInTheDocument();
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  it('flipping the toggle on opens the editor without painting a mask', () => {
    render(<ShapeSection />);
    toggleOn();
    // No painting yet → stays on the rectangle fast path.
    expect(useDesignerStore.getState().params.cellMask).toBeUndefined();
    expect(useDesignerStore.getState().ui.shapeEditorOpen).toBe(true);
  });

  it('flipping the toggle off clears the mask back to the fast path', () => {
    render(<ShapeSection />);
    toggleOn();
    fireEvent.click(screen.getByRole('button', { name: 'L' }));
    expect(useDesignerStore.getState().params.cellMask).toBeDefined();
    fireEvent.click(screen.getByRole('switch', { name: /custom shape/i }));
    expect(useDesignerStore.getState().params.cellMask).toBeUndefined();
  });

  it('applying the L preset carves a partial mask', () => {
    render(<ShapeSection />);
    toggleOn();
    fireEvent.click(screen.getByRole('button', { name: 'L' }));
    const mask = useDesignerStore.getState().params.cellMask;
    expect(mask).toBeDefined();
    expect(mask!.cells.some((c) => c === 0)).toBe(true);
  });

  it('disables presets that are unavailable at small bin sizes', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 1, depth: 1 },
    });
    render(<ShapeSection />);
    toggleOn();
    // L requires 2×2, T and U require 3×2+.
    expect(screen.getByRole('button', { name: 'L' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'T' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'U' })).toBeDisabled();
  });
});
