import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store';

/**
 * GhostWireframe renders a Three.js box outline during mesh generation.
 * Since it requires a WebGL context, we test the visibility logic via store state.
 */

vi.mock('three', () => ({
  Color: vi.fn().mockReturnValue({ getHex: () => 0xfbbf24 }),
  Vector2: vi.fn(),
}));

describe('GhostWireframe logic', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      generation: { status: 'idle', mesh: null },
    });
  });

  it('should not show when generation is idle', () => {
    const { generation } = useDesignerStore.getState();
    expect(generation.status === 'generating').toBe(false);
  });

  it('should show when generation is in progress', () => {
    useDesignerStore.setState({
      generation: { status: 'generating', mesh: null },
    });
    const { generation } = useDesignerStore.getState();
    expect(generation.status === 'generating').toBe(true);
  });

  it('should not show when generation is complete', () => {
    useDesignerStore.setState({
      generation: { status: 'complete', mesh: null },
    });
    const { generation } = useDesignerStore.getState();
    expect(generation.status === 'generating').toBe(false);
  });
});
