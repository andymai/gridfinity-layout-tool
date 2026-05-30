import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OverhangSection } from './OverhangSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import type { CellMask } from '@/shared/utils/cellMask';

describe('OverhangSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders the four per-side controls', () => {
    render(<OverhangSection />);
    expect(screen.getByText('Overhang')).toBeDefined();
    expect(screen.getByText('Left')).toBeDefined();
    expect(screen.getByText('Right')).toBeDefined();
    expect(screen.getByText('Front')).toBeDefined();
    expect(screen.getByText('Back')).toBeDefined();
  });

  it('shows a summary once a side has a non-zero overhang', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, overhang: { left: 3, right: 0, front: 0, back: 2 } },
    });
    render(<OverhangSection />);
    expect(screen.getByText(/L3/)).toBeDefined();
  });

  it('disables the controls for custom-shape bins', () => {
    // 2×2 bin mask with one empty half-cell → partial (custom) shape.
    const mask: CellMask = {
      cols: 4,
      rows: 4,
      cells: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0] as (0 | 1)[],
    };
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 2, depth: 2, cellMask: mask },
    });
    render(<OverhangSection />);
    const gate = document.querySelector('[aria-disabled="true"]');
    expect(gate).not.toBeNull();
  });
});
