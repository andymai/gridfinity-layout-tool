import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        overhang: { left: 0, right: 0, front: 0, back: 0, enabled: true },
      },
    });
    render(<OverhangSection />);
    expect(screen.getByText('Overhang')).toBeDefined();
    expect(screen.getByText('Left')).toBeDefined();
    expect(screen.getByText('Right')).toBeDefined();
    expect(screen.getByText('Front')).toBeDefined();
    expect(screen.getByText('Back')).toBeDefined();
  });

  it('treats a legacy non-zero overhang as enabled and reveals the controls', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, overhang: { left: 3, right: 0, front: 0, back: 2 } },
    });
    render(<OverhangSection />);
    expect(screen.getByText('Left')).toBeDefined();
    expect(screen.getByText('Back')).toBeDefined();
  });

  it('sets and clears the hovered side on pointer enter/leave', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        overhang: { left: 0, right: 0, front: 0, back: 0, enabled: true },
      },
    });
    render(<OverhangSection />);
    // React derives onMouseEnter/Leave from delegated mouseover/mouseout.
    const left = screen.getByText('Left');
    fireEvent.mouseOver(left);
    expect(useDesignerStore.getState().ui.hoveredOverhangSide).toBe('left');
    fireEvent.mouseOut(left);
    expect(useDesignerStore.getState().ui.hoveredOverhangSide).toBeNull();
  });

  it('does not target the feet region when there is no overhang', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        overhang: { left: 0, right: 0, front: 0, back: 0, enabled: true },
      },
    });
    render(<OverhangSection />);
    fireEvent.mouseOver(screen.getByText('Feet under overhang'));
    // Feet toggle is disabled without overhang → hover stays null.
    expect(useDesignerStore.getState().ui.hoveredOverhangSide).toBeNull();
  });

  it('targets the feet region when an overhang exists', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, overhang: { left: 0, right: 4, front: 0, back: 0 } },
    });
    render(<OverhangSection />);
    fireEvent.mouseOver(screen.getByText('Feet under overhang'));
    expect(useDesignerStore.getState().ui.hoveredOverhangSide).toBe('feet');
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
    expect(screen.getByRole('switch')).toBeDisabled();
  });
});
