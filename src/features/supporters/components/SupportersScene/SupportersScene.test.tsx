import { describe, it, expect, vi } from 'vitest';

// The scene is a WebGL component that can't render in jsdom; its behavioural
// logic is covered by the pure util tests (layout, label fitting) and by the
// Playwright visual check. Here we just guard that the module imports cleanly
// and exports a component (the r3f/drei/asset surfaces are mocked so nothing
// touches a GPU context or fetches a GLB).
vi.mock('@react-three/fiber', () => ({ useFrame: vi.fn(), useThree: () => ({}) }));
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  useGLTF: Object.assign(vi.fn(), { setDecoderPath: vi.fn(), preload: vi.fn() }),
}));
vi.mock('../../data/meshes', () => ({
  BIN_MESH_URL: 'bin.glb',
  PLATE_CELL_MESH_URL: 'plate-cell.glb',
  MESH_META: {
    binHeight: 0.6,
    labelTab: { x0: -0.43, x1: 0.43, z0: 0.18, z1: 0.43, y: 0.48 },
    plateHeight: 0.11,
  },
}));

import { SupportersScene } from './SupportersScene';

describe('SupportersScene', () => {
  it('exports a component', () => {
    expect(typeof SupportersScene).toBe('function');
  });
});
