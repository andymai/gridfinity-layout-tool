import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import {
  DEFAULT_BIN_PARAMS,
  DEFAULT_UI_STATE,
  DEFAULT_GENERATION_STATE,
} from '@/features/bin-designer/constants';
import { LidMesh } from './LidMesh';
import {
  lidAnchorZ as lidAnchorZMain,
  lidWallBottomZ as lidWallBottomZMain,
  lidGroupPosition,
  lidHingePose,
} from './lidAnchorZ';
import {
  lidAnchorZ as lidAnchorZWorker,
  lidWallBottomZ as lidWallBottomZWorker,
} from '@/features/generation/worker/generators/lidConstants';
import { LID_FIT_CLEARANCE } from '@/features/bin-designer/types';
import { DEFAULT_LID_HINGE_CONFIG } from '@/features/bin-designer/types/lid';
import type { BinParams, LidRailSide } from '@/features/bin-designer/types';

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
    setIndex = vi.fn();
    computeVertexNormals = vi.fn();
    clearGroups = vi.fn();
    addGroup = vi.fn();
    dispose = vi.fn();
  }
  return {
    BufferGeometry: MockBufferGeometry,
    EdgesGeometry: MockBufferGeometry,
    BufferAttribute: vi.fn(),
    Float32BufferAttribute: vi.fn(),
    Color: vi.fn(),
    DoubleSide: 'DoubleSide',
    FrontSide: 'FrontSide',
  };
});

vi.mock('three/examples/jsm/utils/BufferGeometryUtils.js', () => ({
  toCreasedNormals: vi.fn((geo: unknown) => geo),
}));

beforeEach(() => {
  useDesignerStore.setState({
    params: { ...DEFAULT_BIN_PARAMS },
    ui: { ...DEFAULT_UI_STATE },
  });
});

describe('LidMesh', () => {
  it('renders nothing when no lidMesh is in the store', () => {
    const { container } = render(<LidMesh color="#cccccc" lidOffsetMm={0} wireframe={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no mesh is generated yet (regardless of offset)', () => {
    const { container } = render(<LidMesh color="#cccccc" lidOffsetMm={15} wireframe={false} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('LidMesh color (#1654)', () => {
  const tri = {
    vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2]),
    edgeVertices: new Float32Array([0, 0, 0, 1, 0, 0]),
  };

  function seedLidMesh(): void {
    useDesignerStore.setState({
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'complete',
        mesh: { ...tri, error: null, timingMs: 1, lidMesh: { ...tri, triangleCount: 1 } },
        progress: 0,
        epoch: 0,
      },
    });
  }

  const lidMaterialColor = (container: HTMLElement): string | null | undefined =>
    container.querySelector('meshStandardMaterial')?.getAttribute('color');

  it('paints the lid with the lid zone color when multi-color is enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        featureColors: { ...DEFAULT_BIN_PARAMS.featureColors, enabled: true, lid: '#ff0000' },
      },
    });
    seedLidMesh();
    const { container } = render(<LidMesh color="#cccccc" lidOffsetMm={0} wireframe={false} />);
    // Body fallback ("#cccccc") would be the bug; the lid must follow its zone.
    expect(lidMaterialColor(container)).toBe('#ff0000');
  });

  it('falls back to the body color when multi-color is disabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        featureColors: { ...DEFAULT_BIN_PARAMS.featureColors, enabled: false, lid: '#ff0000' },
      },
    });
    seedLidMesh();
    const { container } = render(<LidMesh color="#cccccc" lidOffsetMm={0} wireframe={false} />);
    expect(lidMaterialColor(container)).toBe('#cccccc');
  });
});

describe('lid Z formulas cross-thread agreement', () => {
  // The lidAnchorZ + lidWallBottomZ formulas are duplicated between the
  // worker (lidConstants.ts) and the main thread (lidAnchorZ.ts) because
  // the worker module can't be imported into the rendered preview bundle.
  // This test compares both implementations across representative inputs
  // so silent drift fails fast.
  const HEIGHT_UNITS = [4, 7, 10] as const; // common Gridfinity values + edges
  for (const heightUnitMm of HEIGHT_UNITS) {
    it(`lidAnchorZ agrees for heightUnitMm=${heightUnitMm}`, () => {
      const main = lidAnchorZMain(heightUnitMm, LID_FIT_CLEARANCE);
      const worker = lidAnchorZWorker(heightUnitMm, LID_FIT_CLEARANCE);
      // Both formulas use Math.SQRT2 → exact equality is reasonable.
      expect(main).toBe(worker);
    });
    it(`lidWallBottomZ agrees for heightUnitMm=${heightUnitMm}`, () => {
      const main = lidWallBottomZMain(heightUnitMm, LID_FIT_CLEARANCE);
      const worker = lidWallBottomZWorker(heightUnitMm, LID_FIT_CLEARANCE);
      expect(main).toBe(worker);
    });
  }
});

describe('lidHingePose', () => {
  const hinged = (side: LidRailSide): BinParams => ({
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 2,
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      attachment: 'hinge',
      hinge: { ...DEFAULT_LID_HINGE_CONFIG, side },
    },
  });

  it('returns nothing for a lid that is not hinged', () => {
    expect(lidHingePose(DEFAULT_BIN_PARAMS, 0)).toBeNull();
  });

  it('lands the mesh in exactly the seated place at 0°', () => {
    // The pose replaces `lidGroupPosition` for a hinged lid, so at zero it has
    // to agree with it to the micron. A pivot that is right at 0° and wrong
    // elsewhere is the normal failure; this pins the half a static preview
    // would show, and the rotation test below pins the half it would not.
    const params = hinged('back');
    const pose = lidHingePose(params, 0);
    expect(pose).not.toBeNull();
    if (!pose) return;
    const net = [0, 1, 2].map((i) => pose.pivot[i] + pose.inner[i]);
    const seated = lidGroupPosition(params, 0);
    for (const i of [0, 1, 2]) expect(net[i]).toBeCloseTo(seated[i], 6);
  });

  it('turns about the wall it is hinged on, not about the lid centre', () => {
    // The pivot sits out at the wall. If it collapsed to the lid's origin the
    // 0° case above would still pass and the lid would sweep through the bin
    // at every other angle.
    const back = lidHingePose(hinged('back'), 0);
    const left = lidHingePose(hinged('left'), 0);
    expect(back?.pivot[1]).toBeGreaterThan(30);
    expect(back?.pivot[0]).toBe(0);
    expect(left?.pivot[0]).toBeLessThan(-30);
    expect(left?.pivot[1]).toBe(0);
  });

  it('opens the front upward, whichever wall carries the hinge', () => {
    // Opening lifts the material INBOARD of the axis, and which rotation does
    // that flips with both the axis direction and which side the wall is on —
    // the four-quadrant trap. Signs pinned against the kernel harness's own
    // convention, which the four-wall swing test proves against real solids.
    expect(lidHingePose(hinged('back'), 90)?.rotation[0]).toBeCloseTo(-Math.PI / 2, 6);
    expect(lidHingePose(hinged('front'), 90)?.rotation[0]).toBeCloseTo(Math.PI / 2, 6);
    expect(lidHingePose(hinged('right'), 90)?.rotation[1]).toBeCloseTo(Math.PI / 2, 6);
    expect(lidHingePose(hinged('left'), 90)?.rotation[1]).toBeCloseTo(-Math.PI / 2, 6);
  });
});
