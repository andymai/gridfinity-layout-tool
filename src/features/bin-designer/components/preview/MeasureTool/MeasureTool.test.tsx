import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, act } from '@testing-library/react';
import { PerspectiveCamera, Raycaster } from 'three';
import { useDesignerStore } from '@/features/bin-designer/store';
import { MeasureTool } from './MeasureTool';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const canvasEl = document.createElement('canvas');
canvasEl.getBoundingClientRect = () =>
  ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0 }) as DOMRect;
const invalidate = vi.fn();

/**
 * A real camera and a real raycaster, not stubs. The tool converts screen
 * pixels to world millimetres through `Vector3.project`, so a fake camera does
 * not exercise the arithmetic the snap tolerance depends on; only R3F's React
 * glue is mocked here, which is the part that needs a WebGL context.
 */
const camera = new PerspectiveCamera(50, 800 / 600, 0.1, 1000);
camera.position.set(0, 0, 60);
camera.up.set(0, 1, 0);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld(true);
camera.updateProjectionMatrix();
const controls = { enabled: true };

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({
    camera,
    gl: { domElement: canvasEl },
    size: { width: 800, height: 600 },
    invalidate,
    controls,
    raycaster: new Raycaster(),
  }),
}));

vi.mock('@react-three/drei', () => ({
  Line: ({ points }: { points: unknown }) => (
    <div data-testid="measure-line" data-points={JSON.stringify(points)} />
  ),
  Text: ({ children }: { children: ReactNode }) => <div data-testid="measure-text">{children}</div>,
}));

/** A 20mm cube spanning z 0..20, centred on the origin in XY. */
function cubeMesh() {
  const v = [
    [-10, -10, 0],
    [10, -10, 0],
    [10, 10, 0],
    [-10, 10, 0],
    [-10, -10, 20],
    [10, -10, 20],
    [10, 10, 20],
    [-10, 10, 20],
  ];
  const faces = [
    [0, 2, 1],
    [0, 3, 2],
    [4, 5, 6],
    [4, 6, 7],
    [0, 1, 5],
    [0, 5, 4],
    [3, 7, 6],
    [3, 6, 2],
    [0, 4, 7],
    [0, 7, 3],
    [1, 2, 6],
    [1, 6, 5],
  ];
  const out: number[] = [];
  for (const f of faces) for (const i of f) out.push(...v[i]);
  // A real index buffer, not an empty one: an empty `Uint32Array` is truthy and
  // correctly reads as zero triangles, which is not what this fixture means.
  const indices = new Uint32Array(out.length / 3);
  for (let i = 0; i < indices.length; i++) indices[i] = i;
  return {
    vertices: new Float32Array(out),
    normals: new Float32Array(out.length),
    indices,
    edgeVertices: new Float32Array([]),
    triangleCount: faces.length,
  };
}

function seedMesh(): void {
  useDesignerStore.setState((s) => ({
    generation: { ...s.generation, mesh: cubeMesh() },
  }));
}

function pointer(type: string, x: number, y: number, init: PointerEventInit = {}): void {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, ...init });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  Object.defineProperty(event, 'pointerType', { value: init.pointerType ?? 'mouse' });
  act(() => {
    if (type === 'pointerup') window.dispatchEvent(event);
    else canvasEl.dispatchEvent(event);
  });
}

const measure = () => useDesignerStore.getState().ui.measure;

describe('MeasureTool', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
    invalidate.mockClear();
  });

  it('draws nothing at rest, so an idle tool costs the scene nothing', () => {
    const { container } = render(<MeasureTool />);
    expect(container).toBeEmptyDOMElement();
  });

  it('places a point on a click that did not travel', () => {
    seedMesh();
    useDesignerStore.getState().setMeasureActive(true);
    render(<MeasureTool />);

    pointer('pointerdown', 400, 300);
    pointer('pointerup', 400, 300);

    expect(measure().points).toHaveLength(1);
  });

  it('treats a travelled pointer as an orbit, not a pick', () => {
    // Told apart by distance rather than duration: a slow, deliberate tap is
    // still a pick, and a fast flick is still an orbit.
    seedMesh();
    useDesignerStore.getState().setMeasureActive(true);
    render(<MeasureTool />);

    pointer('pointerdown', 400, 300);
    pointer('pointermove', 460, 340);
    pointer('pointerup', 460, 340);

    expect(measure().points).toHaveLength(0);
  });

  it('ignores picks entirely while the tool is off', () => {
    seedMesh();
    render(<MeasureTool />);

    pointer('pointerdown', 400, 300);
    pointer('pointerup', 400, 300);

    expect(measure().points).toHaveLength(0);
  });

  it('starts a fresh measurement on the third pick', () => {
    seedMesh();
    useDesignerStore.getState().setMeasureActive(true);
    render(<MeasureTool />);

    for (let i = 0; i < 3; i++) {
      pointer('pointerdown', 400, 300);
      pointer('pointerup', 400, 300);
    }

    expect(measure().points).toHaveLength(1);
  });

  it('measures on shift+drag even with the tool off, and restores orbit after', () => {
    seedMesh();
    render(<MeasureTool />);

    pointer('pointerdown', 400, 300, { shiftKey: true });
    expect(measure().points).toHaveLength(1);

    pointer('pointermove', 460, 340, { shiftKey: true });
    expect(measure().points).toHaveLength(2);

    pointer('pointerup', 460, 340, { shiftKey: true });
    expect(measure().active).toBe(false);
  });

  it('keeps a finished measurement drawn after the tool is switched off', () => {
    // The number outlives the mode on purpose; exiting should not discard it.
    seedMesh();
    useDesignerStore.getState().setMeasurePoints([
      { x: 0, y: 0, z: 0, kind: 'vertex' },
      { x: 10, y: 0, z: 0, kind: 'vertex' },
    ]);
    const { container } = render(<MeasureTool />);
    expect(container).not.toBeEmptyDOMElement();
  });
});
