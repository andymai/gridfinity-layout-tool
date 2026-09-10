import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { createRef } from 'react';
import { OrthographicCamera } from 'three';
import type { OrbitControls } from 'three-stdlib';
import { InvalidateBridge, ScenePickBridge, FrameSelectionBridge } from './WorkshopSceneBridges';
import type { MarqueeRect } from './WorkshopSceneBridges';
import type { PlacedPart } from './workshopPlacement';

const invalidate = vi.fn();
// Top-down ortho camera over a 100x100 canvas whose frustum spans scene
// [-50, 50] on both axes, so scene (x, y) lands at pixel (x + 50, 50 - y).
const camera = new OrthographicCamera(-50, 50, 50, -50, 0.1, 1000);
camera.position.set(0, 0, 100);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();
camera.updateProjectionMatrix();
vi.mock('@react-three/fiber', () => ({
  useThree: (selector?: (s: unknown) => unknown) => {
    const state = { camera, size: { width: 100, height: 100 }, invalidate };
    return selector ? selector(state) : state;
  },
}));
vi.mock('./workshopPlacement', () => ({ storeToScene: (v: number) => v }));

const placed = (selectId: string, x: number, y: number): PlacedPart =>
  ({ selectId, x, y, z: 0, topZ: 0 }) as unknown as PlacedPart;

describe('InvalidateBridge', () => {
  it('lends the canvas invalidate to the ref while mounted', () => {
    const ref = createRef<(() => void) | null>();
    const { unmount } = render(<InvalidateBridge invalidateRef={ref} />);
    expect(ref.current).toBe(invalidate);
    unmount();
    expect(ref.current).toBeNull();
  });
});

describe('ScenePickBridge', () => {
  it('picks the parts whose projected centers fall inside the marquee', () => {
    const pickRef = createRef<((rect: MarqueeRect) => string[]) | null>();
    render(
      <ScenePickBridge
        pickRef={pickRef}
        placements={[placed('near', -25, 25), placed('far', 25, -25)]}
        flatFrameRef={createRef()}
        baseW={100}
        baseD={100}
      />
    );
    expect(pickRef.current?.({ minX: 0, minY: 0, maxX: 50, maxY: 50 })).toEqual(['near']);
    expect(pickRef.current?.({ minX: 0, minY: 0, maxX: 100, maxY: 100 })).toEqual(['near', 'far']);
  });
});

describe('FrameSelectionBridge', () => {
  it('installs a frame action that is a no-op without controls', () => {
    const frameRef = createRef<(() => void) | null>();
    render(
      <FrameSelectionBridge
        frameRef={frameRef}
        controlsRef={createRef<OrbitControls | null>()}
        placements={[]}
        flatFrameRef={createRef()}
        baseW={10}
        baseD={10}
      />
    );
    expect(typeof frameRef.current).toBe('function');
    expect(() => frameRef.current?.()).not.toThrow();
  });
});
