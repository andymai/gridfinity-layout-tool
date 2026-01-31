import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { GhostCompartmentPreview } from './GhostCompartmentPreview';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) => <div data-testid="r3f-canvas">{children}</div>,
  useThree: () => ({
    camera: {
      position: { set: vi.fn(), x: 0, y: 5, z: 5 },
      lookAt: vi.fn(),
      updateProjectionMatrix: vi.fn(),
    },
    invalidate: vi.fn(),
    gl: { domElement: document.createElement('canvas') },
    size: { width: 800, height: 600 },
    scene: {},
  }),
  useFrame: vi.fn(),
  extend: vi.fn(),
}));

vi.mock('three', () => {
  class MockPlaneGeometry {
    translate = vi.fn();
    dispose = vi.fn();
  }

  class MockMeshBasicMaterial {
    dispose = vi.fn();
  }

  class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    set = vi.fn().mockReturnThis();
    clone = vi.fn().mockReturnThis();
  }

  class Vector2 {
    x: number;
    y: number;
    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }
    set = vi.fn().mockReturnThis();
  }

  class Color {
    r = 0.5;
    g = 0.5;
    b = 0.5;
    set = vi.fn().mockReturnThis();
    getHex = vi.fn(() => 0xcccccc);
  }

  return {
    Vector2,
    Vector3,
    Color,
    PlaneGeometry: MockPlaneGeometry,
    MeshBasicMaterial: MockMeshBasicMaterial,
    DoubleSide: 2,
  };
});

vi.mock('three/examples/jsm/lines/LineSegments2.js', () => ({
  LineSegments2: vi.fn(),
}));

vi.mock('three/examples/jsm/lines/LineMaterial.js', () => ({
  LineMaterial: class MockLineMaterial {
    resolution = { set: vi.fn() };
    dispose = vi.fn();
  },
}));

vi.mock('three/examples/jsm/lines/LineSegmentsGeometry.js', () => ({
  LineSegmentsGeometry: class MockLineSegmentsGeometry {
    setPositions = vi.fn();
    dispose = vi.fn();
  },
}));

describe('GhostCompartmentPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDesignerStore.setState({
      params: DEFAULT_BIN_PARAMS,
      ui: {
        previewCompartments: null,
        previewSelection: null,
        designListOpen: false,
        exportDialogOpen: false,
      },
    });
  });

  it('renders nothing when no preview selection', () => {
    const { container } = render(<GhostCompartmentPreview />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing with null preview selection', () => {
    useDesignerStore.setState({
      ui: {
        previewCompartments: null,
        previewSelection: null,
        designListOpen: false,
        exportDialogOpen: false,
      },
    });
    const { container } = render(<GhostCompartmentPreview />);
    expect(container.firstChild).toBeNull();
  });

  it('renders merge preview when preview selection is set for merge', () => {
    useDesignerStore.setState({
      ui: {
        previewCompartments: null,
        previewSelection: {
          action: 'merge',
          minCol: 0,
          maxCol: 1,
          minRow: 0,
          maxRow: 1,
        },
        designListOpen: false,
        exportDialogOpen: false,
      },
    });
    const { container } = render(<GhostCompartmentPreview />);
    expect(container.firstChild).not.toBeNull();
  });
});
