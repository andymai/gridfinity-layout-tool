import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import { OverhangHighlight } from './OverhangHighlight';

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ invalidate: vi.fn() }),
}));

vi.mock('three', () => ({
  DoubleSide: 2,
  Color: class {
    constructor(public value?: string) {}
  },
  MeshBasicMaterial: class {
    dispose = vi.fn();
    constructor(opts: unknown) {
      Object.assign(this, opts);
    }
  },
}));

describe('OverhangHighlight', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders nothing when no overhang control is hovered', () => {
    const { container } = render(<OverhangHighlight />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a single flush face box when a side is hovered at 0mm', () => {
    useDesignerStore.setState({ ui: { ...DEFAULT_UI_STATE, hoveredOverhangSide: 'right' } });
    const { container } = render(<OverhangHighlight />);
    expect(container.querySelectorAll('mesh')).toHaveLength(1);
  });

  it('renders face + grown band when the hovered side has overhang', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, overhang: { left: 0, right: 5, front: 0, back: 0 } },
      ui: { ...DEFAULT_UI_STATE, hoveredOverhangSide: 'right' },
    });
    const { container } = render(<OverhangHighlight />);
    expect(container.querySelectorAll('mesh')).toHaveLength(2);
  });

  it('renders nothing for the feet target when there is no overhang', () => {
    useDesignerStore.setState({ ui: { ...DEFAULT_UI_STATE, hoveredOverhangSide: 'feet' } });
    const { container } = render(<OverhangHighlight />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the bottom ring for the feet target when overhang exists', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, overhang: { left: 3, right: 3, front: 0, back: 0 } },
      ui: { ...DEFAULT_UI_STATE, hoveredOverhangSide: 'feet' },
    });
    const { container } = render(<OverhangHighlight />);
    expect(container.querySelectorAll('mesh')).toHaveLength(2);
  });
});
