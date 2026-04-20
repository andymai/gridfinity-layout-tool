import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { ShapeSection } from './ShapeSection';

describe('ShapeSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 3, depth: 3 },
    });
  });

  it('renders preset buttons (Rectangle, L, T, U)', () => {
    render(<ShapeSection />);
    expect(screen.getByRole('button', { name: 'Rectangle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'L' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'T' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'U' })).toBeInTheDocument();
  });

  it('applying the L preset sets a partial cellMask', () => {
    render(<ShapeSection />);
    fireEvent.click(screen.getByRole('button', { name: 'L' }));
    const mask = useDesignerStore.getState().params.cellMask;
    expect(mask).toBeDefined();
    expect(mask!.cells.some((c) => c === 0)).toBe(true);
  });

  it('applying Rectangle clears the cellMask back to the fast-path', () => {
    render(<ShapeSection />);
    fireEvent.click(screen.getByRole('button', { name: 'L' }));
    expect(useDesignerStore.getState().params.cellMask).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Rectangle' }));
    expect(useDesignerStore.getState().params.cellMask).toBeUndefined();
  });

  it('disables presets that are unavailable at small bin sizes', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 1, depth: 1 },
    });
    render(<ShapeSection />);
    // L requires 2×2, T and U require 3×2+.
    expect(screen.getByRole('button', { name: 'L' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'T' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'U' })).toBeDisabled();
    // Rectangle is always available.
    expect(screen.getByRole('button', { name: 'Rectangle' })).not.toBeDisabled();
  });
});
