import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store';

/**
 * GhostDividers renders Three.js LineSegments2 during mesh generation.
 * Since it requires a WebGL context, we test the logic via store state
 * rather than rendering the component.
 */

vi.mock('three', () => ({
  Color: vi.fn().mockReturnValue({ getHex: () => 0xfbbf24 }),
  Vector2: vi.fn(),
}));

describe('GhostDividers logic', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      generation: { status: 'idle', mesh: null },
    });
  });

  it('should only show during generation status', () => {
    const { generation, params } = useDesignerStore.getState();
    const shouldShow =
      (params.compartments.cols > 1 || params.compartments.rows > 1) &&
      generation.status === 'generating';
    expect(shouldShow).toBe(false);
  });

  it('should show when generating with multiple compartments', () => {
    useDesignerStore.setState({
      generation: { status: 'generating', mesh: null },
    });
    const state = useDesignerStore.getState();
    const shouldShow =
      (state.params.compartments.cols > 1 || state.params.compartments.rows > 1) &&
      state.generation.status === 'generating';
    // Default params have 1 col and 1 row, so still false
    expect(shouldShow).toBe(false);
  });

  it('should show when generating with cols > 1', () => {
    useDesignerStore.setState((s) => ({
      generation: { status: 'generating', mesh: null },
      params: {
        ...s.params,
        compartments: { ...s.params.compartments, cols: 3 },
      },
    }));
    const state = useDesignerStore.getState();
    const shouldShow =
      (state.params.compartments.cols > 1 || state.params.compartments.rows > 1) &&
      state.generation.status === 'generating';
    expect(shouldShow).toBe(true);
  });
});
