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
  })),
  Spherical: vi.fn().mockImplementation(() => ({
    setFromVector3: vi.fn().mockReturnThis(),
    radius: 100,
    phi: 1,
    theta: 1,
  })),
}));

vi.mock('@/shared/printSettings/gridfinityGeometry', () => ({
  GRIDFINITY_SPEC: { SOCKET_HEIGHT: 5 },
}));

const { useBaseplatePresetTransition } = await import('./useBaseplatePresetTransition');

describe('useBaseplatePresetTransition', () => {
  it('exports a hook function', () => {
    expect(typeof useBaseplatePresetTransition).toBe('function');
  });
});
