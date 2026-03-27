import { describe, it, expect, vi } from 'vitest';

vi.mock('three', () => ({
  Vector3: vi.fn().mockImplementation(() => ({
    normalize: vi.fn().mockReturnThis(),
    multiplyScalar: vi.fn().mockReturnThis(),
    add: vi.fn().mockReturnThis(),
    clone: vi.fn().mockReturnThis(),
    sub: vi.fn().mockReturnThis(),
    copy: vi.fn(),
    set: vi.fn(),
    lerpVectors: vi.fn(),
  })),
}));

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ invalidate: vi.fn(), camera: { position: { clone: vi.fn() } } }),
  useFrame: vi.fn(),
}));

vi.mock('@/shared/printSettings/gridfinityGeometry', () => ({
  GRIDFINITY_SPEC: { SOCKET_HEIGHT: 5 },
}));

const { CameraController } = await import('./CameraController');

describe('CameraController', () => {
  it('exports a component function', () => {
    expect(typeof CameraController).toBe('function');
  });
});
