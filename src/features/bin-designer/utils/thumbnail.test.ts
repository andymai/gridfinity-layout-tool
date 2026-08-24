// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  Scene,
  PerspectiveCamera,
  Mesh,
  BoxGeometry,
  MeshStandardMaterial,
  LineSegments,
  EdgesGeometry,
  LineBasicMaterial,
  InstancedBufferGeometry,
  BufferAttribute,
} from 'three';
import { LineMaterial, LineSegments2, LineSegmentsGeometry } from 'three-stdlib';
import type { WebGLRenderer } from 'three';
import {
  captureThumbnail,
  captureThumbnailPNG,
  captureCommunityThumbnails,
  exportCommunityGlb,
  setPreviewCanvas,
  setPreviewContext,
  clearPreviewCanvas,
  __setEdgeVisibility,
} from './thumbnail';
import type { BinFramingDimensions } from './thumbnail';

describe('thumbnail', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockCtx: CanvasRenderingContext2D;

  beforeEach(() => {
    // Create a mock canvas that simulates the Three.js preview
    mockCanvas = document.createElement('canvas');
    mockCanvas.width = 800;
    mockCanvas.height = 600;

    // Mock getContext for the offscreen canvas used internally
    mockCtx = {
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
      contextId: string
    ) {
      if (contextId === '2d' && this !== mockCanvas) {
        return mockCtx;
      }
      return null;
    } as typeof HTMLCanvasElement.prototype.getContext);

    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/webp;base64,mockThumb'
    );
  });

  afterEach(() => {
    clearPreviewCanvas();
    vi.restoreAllMocks();
  });

  it('returns null when no canvas is registered', () => {
    expect(captureThumbnail()).toBeNull();
  });

  it('returns null after clearPreviewCanvas', () => {
    setPreviewCanvas(mockCanvas);
    clearPreviewCanvas();
    expect(captureThumbnail()).toBeNull();
  });

  it('captures a WebP data URL when canvas is registered', () => {
    setPreviewCanvas(mockCanvas);

    const result = captureThumbnail();

    expect(result).toBe('data:image/webp;base64,mockThumb');
  });

  it('draws the canvas center-cropped to 384x384', () => {
    setPreviewCanvas(mockCanvas);
    captureThumbnail();

    // Source is 800x600, so crop to 600x600 centered (srcX = 100, srcY = 0)
    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      mockCanvas,
      100,
      0,
      600,
      600, // source: center-cropped square
      0,
      0,
      384,
      384 // destination: thumbnail size
    );
  });

  it('handles square canvas without offset', () => {
    mockCanvas.width = 500;
    mockCanvas.height = 500;
    setPreviewCanvas(mockCanvas);
    captureThumbnail();

    expect(mockCtx.drawImage).toHaveBeenCalledWith(mockCanvas, 0, 0, 500, 500, 0, 0, 384, 384);
  });

  it('handles tall canvas (portrait) with vertical center crop', () => {
    mockCanvas.width = 400;
    mockCanvas.height = 800;
    setPreviewCanvas(mockCanvas);
    captureThumbnail();

    // Min dimension is 400, so srcY = (800-400)/2 = 200
    expect(mockCtx.drawImage).toHaveBeenCalledWith(mockCanvas, 0, 200, 400, 400, 0, 0, 384, 384);
  });

  it('calls toDataURL with WebP format at 0.9 quality', () => {
    setPreviewCanvas(mockCanvas);
    captureThumbnail();

    // toDataURL is called on the offscreen canvas (not the source)
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith('image/webp', 0.9);
  });

  it('returns null if offscreen getContext fails', () => {
    vi.restoreAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    setPreviewCanvas(mockCanvas);
    expect(captureThumbnail()).toBeNull();
  });
});

describe('captureThumbnailPNG', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockCtx: CanvasRenderingContext2D;

  beforeEach(() => {
    mockCanvas = document.createElement('canvas');
    mockCanvas.width = 800;
    mockCanvas.height = 600;

    mockCtx = {
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
      contextId: string
    ) {
      if (contextId === '2d' && this !== mockCanvas) {
        return mockCtx;
      }
      return null;
    } as typeof HTMLCanvasElement.prototype.getContext);
  });

  afterEach(() => {
    clearPreviewCanvas();
    vi.restoreAllMocks();
  });

  it('returns null when no canvas is registered', async () => {
    const result = await captureThumbnailPNG();
    expect(result).toBeNull();
  });

  it('draws center-cropped to 256x256', async () => {
    setPreviewCanvas(mockCanvas);

    const mockBlob = {
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
    } as unknown as Blob;
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      _cb: BlobCallback
    ) {
      _cb(mockBlob);
    });

    await captureThumbnailPNG();

    // Source 800x600, crop to 600x600 centered (srcX=100, srcY=0)
    expect(mockCtx.drawImage).toHaveBeenCalledWith(mockCanvas, 100, 0, 600, 600, 0, 0, 256, 256);
  });

  it('returns Uint8Array from blob', async () => {
    setPreviewCanvas(mockCanvas);

    const pngData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const mockBlob = {
      arrayBuffer: () => Promise.resolve(pngData.buffer),
    } as unknown as Blob;

    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      _cb: BlobCallback
    ) {
      _cb(mockBlob);
    });

    const result = await captureThumbnailPNG();
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result?.length).toBe(4);
  });

  it('returns null when toBlob returns null', async () => {
    setPreviewCanvas(mockCanvas);

    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      _cb: BlobCallback
    ) {
      _cb(null);
    });

    const result = await captureThumbnailPNG();
    expect(result).toBeNull();
  });

  it('returns null when arrayBuffer rejects', async () => {
    setPreviewCanvas(mockCanvas);

    const mockBlob = {
      arrayBuffer: () => Promise.reject(new Error('read failed')),
    } as unknown as Blob;

    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      _cb: BlobCallback
    ) {
      _cb(mockBlob);
    });

    const result = await captureThumbnailPNG();
    expect(result).toBeNull();
  });

  it('returns null if getContext fails', async () => {
    vi.restoreAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    setPreviewCanvas(mockCanvas);
    const result = await captureThumbnailPNG();
    expect(result).toBeNull();
  });

  it('returns null if canvas throws (tainted)', async () => {
    vi.restoreAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      throw new Error('Canvas is tainted');
    });

    setPreviewCanvas(mockCanvas);
    const result = await captureThumbnailPNG();
    expect(result).toBeNull();
  });
});

const DIMS: BinFramingDimensions = {
  width: 2,
  depth: 1,
  height: 3,
  gridUnitMm: 42,
  heightUnitMm: 7,
};

describe('captureCommunityThumbnails', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockCtx: CanvasRenderingContext2D;

  beforeEach(() => {
    mockCanvas = document.createElement('canvas');
    mockCanvas.width = 800;
    mockCanvas.height = 600;

    mockCtx = {
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
      contextId: string
    ) {
      if (contextId === '2d' && this !== mockCanvas) {
        return mockCtx;
      }
      return null;
    } as typeof HTMLCanvasElement.prototype.getContext);

    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/webp;base64,mockThumb'
    );
  });

  afterEach(() => {
    clearPreviewCanvas();
    vi.restoreAllMocks();
  });

  it('returns null when no preview context is registered, even with a canvas', async () => {
    setPreviewCanvas(mockCanvas);
    await expect(captureCommunityThumbnails(DIMS)).resolves.toBeNull();
  });

  it('captures three WebP shots from distinct camera positions', async () => {
    setPreviewCanvas(mockCanvas);
    const scene = new Scene();
    const camera = new PerspectiveCamera(45);
    const renderPositions: { x: number; y: number; z: number }[] = [];
    const renderer = {
      render: vi.fn(() => {
        renderPositions.push({
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z,
        });
      }),
    } as unknown as WebGLRenderer;
    setPreviewContext(renderer, scene, camera);

    const result = await captureCommunityThumbnails(DIMS);

    expect(result).toHaveLength(3);
    for (const url of result ?? []) {
      expect(url.startsWith('data:image/webp')).toBe(true);
    }

    // Each capture renders twice (preset frame + restore), so the preset
    // positions are the even-indexed render calls.
    expect(renderPositions).toHaveLength(6);
    const presets = [renderPositions[0], renderPositions[2], renderPositions[4]];
    for (let i = 0; i < presets.length; i++) {
      for (let j = i + 1; j < presets.length; j++) {
        const same =
          Math.abs(presets[i].x - presets[j].x) < 1e-6 &&
          Math.abs(presets[i].y - presets[j].y) < 1e-6 &&
          Math.abs(presets[i].z - presets[j].z) < 1e-6;
        expect(same).toBe(false);
      }
    }
  });

  it('uses the default WebP encoder settings for every shot', async () => {
    setPreviewCanvas(mockCanvas);
    const renderer = { render: vi.fn() } as unknown as WebGLRenderer;
    setPreviewContext(renderer, new Scene(), new PerspectiveCamera(45));

    await captureCommunityThumbnails(DIMS);

    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledTimes(3);
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith('image/webp', 0.9);
  });

  it('returns null when the context is registered but no canvas yields pixels', async () => {
    const renderer = { render: vi.fn() } as unknown as WebGLRenderer;
    setPreviewContext(renderer, new Scene(), new PerspectiveCamera(45));

    await expect(captureCommunityThumbnails(DIMS)).resolves.toBeNull();
  });
});

describe('exportCommunityGlb', () => {
  afterEach(() => {
    clearPreviewCanvas();
    vi.restoreAllMocks();
  });

  it('returns null when no preview scene is registered', async () => {
    await expect(exportCommunityGlb()).resolves.toBeNull();
  });

  it('returns base64 GLB with glTF magic bytes for a registered scene', async () => {
    const scene = new Scene();
    scene.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: 0x808080 })));
    const renderer = { render: vi.fn() } as unknown as WebGLRenderer;
    setPreviewContext(renderer, scene, new PerspectiveCamera(45));

    const result = await exportCommunityGlb();

    expect(result).not.toBeNull();
    const decoded = atob(result ?? '');
    expect(decoded.slice(0, 4)).toBe('glTF');
    expect(decoded.length).toBeGreaterThan(12);
  });

  it('returns null for a scene with no visible meshes', async () => {
    const renderer = { render: vi.fn() } as unknown as WebGLRenderer;
    setPreviewContext(renderer, new Scene(), new PerspectiveCamera(45));

    await expect(exportCommunityGlb()).resolves.toBeNull();
  });

  describe('annotation overlays', () => {
    /**
     * The real class behind drei's fat `<Line>`, which the dimension drawings
     * use. `LineSegments2` extends `Mesh`, so the plain `isMesh` sweep took it,
     * and its shape lives in `instanceStart`/`instanceEnd` rather than in the
     * base quad that `position` holds.
     */
    function fatLine(): Mesh {
      const geometry = new LineSegmentsGeometry();
      geometry.setPositions([0, 0, 0, 10, 10, 10]);
      return new LineSegments2(geometry, new LineMaterial({ color: 0xffffff }));
    }

    /**
     * Stands in for troika's `<Text>`, whose `GlyphsGeometry` is likewise an
     * `InstancedBufferGeometry` on a `Mesh`. Troika is drei's dependency rather
     * than ours, so it is modelled here instead of imported.
     */
    function textLabel(): Mesh {
      const geometry = new InstancedBufferGeometry();
      geometry.setAttribute(
        'position',
        new BufferAttribute(
          new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0]),
          3
        )
      );
      geometry.instanceCount = 13;
      return new Mesh(geometry, new MeshStandardMaterial({ color: 0xffffff }));
    }

    /** Vertex counts per exported primitive, read out of the GLB's JSON chunk. */
    function positionCounts(base64: string): number[] {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const view = new DataView(bytes.buffer);
      const jsonLength = view.getUint32(12, true);
      const json: unknown = JSON.parse(
        new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength))
      );
      const { meshes, accessors } = json as {
        meshes: { primitives: { attributes: { POSITION: number } }[] }[];
        accessors: { count: number }[];
      };
      return meshes.flatMap((mesh) =>
        mesh.primitives.map((prim) => accessors[prim.attributes.POSITION].count)
      );
    }

    it.each([
      ['a fat dimension line', fatLine],
      ['a text label', textLabel],
    ])('exports nothing for a scene that is only %s', async (_label, build) => {
      const scene = new Scene();
      scene.add(build());
      const renderer = { render: vi.fn() } as unknown as WebGLRenderer;
      setPreviewContext(renderer, scene, new PerspectiveCamera(45));

      await expect(exportCommunityGlb()).resolves.toBeNull();
    });

    it('skips selection chrome marked with renderOrder >= 2', async () => {
      const renderer = { render: vi.fn() } as unknown as WebGLRenderer;

      const chromeOnly = new Scene();
      const ring = new Mesh(
        new BoxGeometry(1, 1, 1),
        new MeshStandardMaterial({ color: 0x5aa7ff })
      );
      ring.renderOrder = 2;
      chromeOnly.add(ring);
      setPreviewContext(renderer, chromeOnly, new PerspectiveCamera(45));
      await expect(exportCommunityGlb()).resolves.toBeNull();

      const bare = new Scene();
      bare.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: 0x808080 })));
      setPreviewContext(renderer, bare, new PerspectiveCamera(45));
      const withoutChrome = positionCounts((await exportCommunityGlb()) ?? '');

      const selected = new Scene();
      const chrome = new Mesh(
        new BoxGeometry(1, 1, 1),
        new MeshStandardMaterial({ color: 0x5aa7ff })
      );
      chrome.renderOrder = 2;
      selected.add(
        new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: 0x808080 })),
        chrome
      );
      setPreviewContext(renderer, selected, new PerspectiveCamera(45));
      const withChrome = positionCounts((await exportCommunityGlb()) ?? '');

      expect(withChrome).toEqual(withoutChrome);
    });

    it('leaves the model untouched when annotations sit alongside it', async () => {
      const renderer = { render: vi.fn() } as unknown as WebGLRenderer;

      const bare = new Scene();
      bare.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: 0x808080 })));
      setPreviewContext(renderer, bare, new PerspectiveCamera(45));
      const withoutAnnotations = positionCounts((await exportCommunityGlb()) ?? '');

      const annotated = new Scene();
      annotated.add(
        new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: 0x808080 })),
        fatLine(),
        textLabel()
      );
      setPreviewContext(renderer, annotated, new PerspectiveCamera(45));
      const withAnnotations = positionCounts((await exportCommunityGlb()) ?? '');

      // A baked annotation would have merged its base quad in, adding vertices
      // and drawing a stray white square wherever its label sat.
      expect(withAnnotations).toEqual(withoutAnnotations);
    });
  });

  describe('__setEdgeVisibility', () => {
    function sceneWithEdges(): { scene: Scene; edges: LineSegments; mesh: Mesh } {
      const scene = new Scene();
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial());
      const edges = new LineSegments(
        new EdgesGeometry(new BoxGeometry(1, 1, 1)),
        new LineBasicMaterial()
      );
      scene.add(mesh, edges);
      return { scene, edges, mesh };
    }

    it('hides every edge overlay and reports how many it touched', () => {
      const { scene, edges } = sceneWithEdges();
      const renderer = { render: vi.fn() } as unknown as WebGLRenderer;
      setPreviewContext(renderer, scene, new PerspectiveCamera(45));

      expect(__setEdgeVisibility(false)).toBe(1);
      expect(edges.visible).toBe(false);
    });

    it('leaves meshes alone', () => {
      const { scene, mesh } = sceneWithEdges();
      const renderer = { render: vi.fn() } as unknown as WebGLRenderer;
      setPreviewContext(renderer, scene, new PerspectiveCamera(45));

      __setEdgeVisibility(false);

      expect(mesh.visible).toBe(true);
    });

    it('redraws, since frameloop="demand" would otherwise keep the old frame', () => {
      const { scene } = sceneWithEdges();
      const renderer = { render: vi.fn() } as unknown as WebGLRenderer;
      setPreviewContext(renderer, scene, new PerspectiveCamera(45));

      __setEdgeVisibility(false);

      expect(renderer.render).toHaveBeenCalledTimes(1);
    });

    it('is reversible', () => {
      const { scene, edges } = sceneWithEdges();
      const renderer = { render: vi.fn() } as unknown as WebGLRenderer;
      setPreviewContext(renderer, scene, new PerspectiveCamera(45));

      __setEdgeVisibility(false);
      __setEdgeVisibility(true);

      expect(edges.visible).toBe(true);
    });

    it('reports zero when no context is registered', () => {
      clearPreviewCanvas();

      expect(__setEdgeVisibility(false)).toBe(0);
    });
  });
});
