import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import type { ReactNode } from 'react';
import type { Bin } from '@/core/types';
import type { BinRenderData } from '@/shared/hooks/useExplodedLayerView';
import type { BinTransition } from '../useBinTransitions';
import { AnimatedBinMesh } from './AnimatedBinMesh';

// Mock React Three Fiber
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) => <div data-testid="r3f-canvas">{children}</div>,
  useThree: () => ({
    camera: { position: { set: vi.fn() }, lookAt: vi.fn(), updateProjectionMatrix: vi.fn() },
    invalidate: vi.fn(),
    gl: { domElement: document.createElement('canvas') },
    size: { width: 800, height: 600 },
    scene: {},
  }),
  useFrame: vi.fn(),
  extend: vi.fn(),
}));

// Mock Three.js
vi.mock('three', () => {
  const Vector3 = vi.fn(() => ({
    set: vi.fn().mockReturnThis(),
    clone: vi.fn().mockReturnThis(),
  }));
  const Color = vi.fn(() => ({
    r: 0.5,
    g: 0.5,
    b: 0.5,
    set: vi.fn().mockReturnThis(),
  }));
  return {
    Vector3,
    Color,
    BufferGeometry: vi.fn(() => ({
      setAttribute: vi.fn(),
      setIndex: vi.fn(),
      computeVertexNormals: vi.fn(),
      dispose: vi.fn(),
    })),
    Float32BufferAttribute: vi.fn(),
    BufferAttribute: vi.fn(),
    MeshStandardMaterial: vi.fn(() => ({
      dispose: vi.fn(),
      color: new Color(),
      emissiveIntensity: 0,
    })),
    DoubleSide: 2,
  };
});

// Mock useBinGeometry hook
vi.mock('@/shared/hooks/useBinGeometry', () => ({
  useBinGeometry: () => ({ setAttribute: vi.fn(), dispose: vi.fn() }),
}));

const mockBin: Bin = {
  id: 'test-bin-1',
  x: 2,
  y: 2,
  width: 2,
  depth: 2,
  height: 3,
  layerId: 'layer-1',
  category: 'cat-1',
  label: 'Test Bin',
  notes: '',
};

const mockBinData: BinRenderData = {
  bin: mockBin,
  x: 2,
  y: 2,
  z: 0,
  height: 0.5,
  clearanceHeight: 0,
  color: '#ff0000',
  opacity: 1,
};

describe('AnimatedBinMesh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('renders with entering transition', () => {
    const transition: BinTransition = {
      phase: 'entering',
      springPos: 2.0,
      springVel: 0,
      staggerDelay: 0,
      elapsed: 0,
    };

    const { container } = render(<AnimatedBinMesh binData={mockBinData} transition={transition} />);
    expect(container).toBeTruthy();
  });

  it('renders with exiting transition', () => {
    const transition: BinTransition = {
      phase: 'exiting',
      scale: 0.5,
      opacity: 0.5,
      staggerDelay: 0,
      elapsed: 0.1,
    };

    const { container } = render(<AnimatedBinMesh binData={mockBinData} transition={transition} />);
    expect(container).toBeTruthy();
  });
});
