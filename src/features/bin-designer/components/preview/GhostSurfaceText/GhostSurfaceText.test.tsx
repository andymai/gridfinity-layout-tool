import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { GhostSurfaceText } from './GhostSurfaceText';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ invalidate: vi.fn() }),
}));

const measurer = { value: null as unknown };
vi.mock('@/features/bin-designer/hooks/useTypeMeasurer', () => ({
  useTypeMeasurer: () => measurer.value,
}));

describe('GhostSurfaceText', () => {
  beforeEach(() => {
    measurer.value = null;
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, surfaceText: { walls: { front: 'CABLES' } } },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('draws nothing until the faces have registered', () => {
    // Rendering an outline from metrics that have not loaded would put the
    // preview somewhere the print will not be.
    const { container } = render(<GhostSurfaceText />);
    expect(container.firstChild).toBeNull();
  });

  it('draws nothing once the real mesh has landed', () => {
    useDesignerStore.setState({
      generation: { ...useDesignerStore.getState().generation, status: 'idle' },
    } as never);
    const { container } = render(<GhostSurfaceText />);
    expect(container.firstChild).toBeNull();
  });
});
