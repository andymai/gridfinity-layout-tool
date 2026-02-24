import { describe, it, expect, vi } from 'vitest';

// Mock Three.js line classes
vi.mock('three/examples/jsm/lines/LineSegments2.js', () => ({
  LineSegments2: vi.fn().mockImplementation(() => ({
    geometry: { dispose: vi.fn(), setPositions: vi.fn() },
    material: { dispose: vi.fn() },
    visible: true,
    removeFromParent: vi.fn(),
  })),
}));
vi.mock('three/examples/jsm/lines/LineMaterial.js', () => ({
  LineMaterial: vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
    resolution: { set: vi.fn() },
  })),
}));
vi.mock('three/examples/jsm/lines/LineSegmentsGeometry.js', () => ({
  LineSegmentsGeometry: vi.fn().mockImplementation(() => ({
    setPositions: vi.fn(),
    dispose: vi.fn(),
  })),
}));

// Mock react-three/fiber
const mockInvalidate = vi.fn();
vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ invalidate: mockInvalidate, size: { width: 800, height: 600 } }),
  useFrame: vi.fn(),
}));

// Mock three
vi.mock('three', () => ({
  Group: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    remove: vi.fn(),
    children: [],
  })),
}));

describe('GhostPaddingOutline', () => {
  it('exports a component function', async () => {
    const mod = await import('./GhostPaddingOutline');
    expect(mod.GhostPaddingOutline).toBeTypeOf('function');
  });
});
