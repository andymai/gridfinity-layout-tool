import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import { LidGuideLine } from './LidGuideLine';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) => <div data-testid="r3f-canvas">{children}</div>,
  useThree: () => ({
    invalidate: vi.fn(),
    gl: { domElement: document.createElement('canvas') },
    size: { width: 800, height: 600 },
    scene: {},
  }),
  useFrame: vi.fn(),
  extend: vi.fn(),
}));

vi.mock('three', () => {
  class MockBufferGeometry {
    setAttribute = vi.fn();
    dispose = vi.fn();
  }
  return {
    BufferGeometry: MockBufferGeometry,
    BufferAttribute: vi.fn(),
  };
});

beforeEach(() => {
  useDesignerStore.setState({
    params: { ...DEFAULT_BIN_PARAMS },
    ui: { ...DEFAULT_UI_STATE },
  });
});

describe('LidGuideLine', () => {
  it('renders nothing when offset is below the visible threshold', () => {
    const { container } = render(<LidGuideLine lidOffsetMm={1} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when offset is exactly 0 (snapped)', () => {
    const { container } = render(<LidGuideLine lidOffsetMm={0} />);
    expect(container.firstChild).toBeNull();
  });
});
