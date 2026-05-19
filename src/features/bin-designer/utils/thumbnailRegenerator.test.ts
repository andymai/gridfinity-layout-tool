// @vitest-environment jsdom

/**
 * Tests for the offscreen thumbnail regenerator.
 *
 * The full WebGL stack can't run under jsdom, so we mock `THREE.WebGLRenderer`
 * and the generation bridge, then assert the regenerator's *contract* against
 * the mesh data the worker provides:
 *   - calls `geometry.setIndex(...)` when `indices` is present (the bug fix
 *     for the corrupted-thumbnail issue — without it Three.js draws random
 *     triangles between consecutive vertices instead of using the worker's
 *     indexed topology)
 *   - bails early on empty meshes, abort signals, and bridge failures
 *   - releases the bridge ref + disposes the renderer in every exit path
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import type * as ThreeModule from 'three';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import type { BinParams } from '../types';

// vi.mock factories are hoisted above any test-file `const` declarations, so
// references to test-file locals don't work. vi.hoisted lifts these shared
// handles so the mocks can capture into them.
const { generateImmediate, rendererInstances } = vi.hoisted(() => ({
  generateImmediate: vi.fn(),
  rendererInstances: [] as Array<{
    render: ReturnType<typeof vi.fn>;
    setSize: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    forceContextLoss: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock('@/shared/generation/bridge', () => ({
  bridgeManager: {
    acquire: vi.fn().mockResolvedValue({
      generateImmediate,
    }),
    release: vi.fn(),
  },
}));

vi.mock('@/shared/hooks/useThemeEffect', () => ({
  THREE_COLORS: {
    light: { gradientTop: '#ffffff', groundBounce: '#cccccc' },
    dark: { gradientTop: '#000000', groundBounce: '#222222' },
  },
}));

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof ThreeModule>('three');
  // Use a `function` (not arrow) so `new THREE.WebGLRenderer(...)` works —
  // Vitest 4 rejects `new` on an arrow-backed mock.
  return {
    ...actual,
    WebGLRenderer: vi.fn().mockImplementation(function () {
      const inst = {
        render: vi.fn(),
        setSize: vi.fn(),
        dispose: vi.fn(),
        forceContextLoss: vi.fn(),
      };
      rendererInstances.push(inst);
      return inst;
    }),
  };
});

// jsdom's HTMLCanvasElement.toDataURL returns an empty string when no 2D
// context is registered. Stub it to a non-null value so the regenerator
// treats the capture as successful.
function stubToDataURL(): void {
  HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/webp;base64,FAKE');
}

import { regenerateThumbnail } from './thumbnailRegenerator';
import { bridgeManager } from '@/shared/generation/bridge';

function makeMesh(
  overrides: {
    vertices?: Float32Array;
    normals?: Float32Array;
    indices?: Uint32Array;
    edgeVertices?: Float32Array;
  } = {}
) {
  return {
    vertices: overrides.vertices ?? new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: overrides.normals ?? new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: overrides.indices ?? new Uint32Array([0, 1, 2]),
    edgeVertices: overrides.edgeVertices ?? new Float32Array([0, 0, 0, 1, 0, 0]),
    triangleCount: 1,
  };
}

function makeParams(): BinParams {
  return { ...DEFAULT_BIN_PARAMS };
}

describe('regenerateThumbnail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rendererInstances.length = 0;
    stubToDataURL();
  });

  it('sets the index buffer on the geometry — the core bug fix', async () => {
    const indices = new Uint32Array([0, 1, 2, 1, 2, 0]);
    generateImmediate.mockResolvedValue({ mesh: makeMesh({ indices }) });

    const setIndexSpy = vi.spyOn(THREE.BufferGeometry.prototype, 'setIndex');

    const result = await regenerateThumbnail(makeParams());

    expect(result).toBe('data:image/webp;base64,FAKE');
    expect(setIndexSpy).toHaveBeenCalled();
    const indexAttribute = setIndexSpy.mock.calls[0]?.[0] as THREE.BufferAttribute;
    // setIndex receives a BufferAttribute wrapping our Uint32Array.
    expect(indexAttribute.array).toBe(indices);
    expect(indexAttribute.itemSize).toBe(1);

    setIndexSpy.mockRestore();
  });

  it('skips setIndex when the worker returns an empty index buffer', async () => {
    generateImmediate.mockResolvedValue({
      mesh: makeMesh({ indices: new Uint32Array(0) }),
    });
    const setIndexSpy = vi.spyOn(THREE.BufferGeometry.prototype, 'setIndex');

    await regenerateThumbnail(makeParams());

    expect(setIndexSpy).not.toHaveBeenCalled();
    setIndexSpy.mockRestore();
  });

  it('returns null and skips rendering when vertices are empty', async () => {
    generateImmediate.mockResolvedValue({
      mesh: makeMesh({ vertices: new Float32Array(0) }),
    });

    const result = await regenerateThumbnail(makeParams());

    expect(result).toBeNull();
    // No renderer constructed — we bailed before the WebGL setup.
    expect(rendererInstances).toHaveLength(0);
  });

  it('returns null when the abort signal fires before mesh generation', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await regenerateThumbnail(makeParams(), controller.signal);

    expect(result).toBeNull();
    expect(generateImmediate).not.toHaveBeenCalled();
  });

  it('returns null when the bridge call rejects, and still releases the bridge', async () => {
    generateImmediate.mockRejectedValue(new Error('bridge failed'));

    const result = await regenerateThumbnail(makeParams());

    expect(result).toBeNull();
    // Bridge was acquired and must be released even on the error path.
    expect(bridgeManager.acquire).toHaveBeenCalled();
    expect(bridgeManager.release).toHaveBeenCalled();
  });

  it('disposes the renderer and releases the bridge on the happy path', async () => {
    generateImmediate.mockResolvedValue({ mesh: makeMesh() });

    await regenerateThumbnail(makeParams());

    expect(rendererInstances).toHaveLength(1);
    expect(rendererInstances[0]?.dispose).toHaveBeenCalled();
    expect(rendererInstances[0]?.forceContextLoss).toHaveBeenCalled();
    expect(bridgeManager.release).toHaveBeenCalled();
  });
});
