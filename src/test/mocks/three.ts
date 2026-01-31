import { vi } from 'vitest';

/**
 * Shared Three.js mocks for testing R3F components.
 * Use these mocks in any test that renders Three.js/R3F components.
 */

export function mockThree() {
  // BufferGeometry constructor
  class MockBufferGeometry {
    setAttribute = vi.fn();
    setIndex = vi.fn();
    computeVertexNormals = vi.fn();
    dispose = vi.fn();
    translate = vi.fn();
  }

  // Vector3 constructor
  class MockVector3 {
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
    normalize = vi.fn().mockReturnThis();
    multiplyScalar = vi.fn().mockReturnThis();
    add = vi.fn().mockReturnThis();
    sub = vi.fn().mockReturnThis();
    copy = vi.fn().mockReturnThis();
    lerp = vi.fn().mockReturnThis();
    toArray = vi.fn(() => [this.x, this.y, this.z]);
    setFromSpherical = vi.fn().mockReturnThis();
  }

  // Color constructor
  class MockColor {
    r = 0.5;
    g = 0.5;
    b = 0.5;

    constructor(hex?: number) {
      if (hex !== undefined) {
        this.r = ((hex >> 16) & 255) / 255;
        this.g = ((hex >> 8) & 255) / 255;
        this.b = (hex & 255) / 255;
      }
    }

    set = vi.fn().mockReturnThis();
    getHex = vi.fn(() => 0xcccccc);
    lerp = vi.fn().mockReturnThis();
  }

  return {
    Vector3: MockVector3,
    Color: MockColor,
    BufferGeometry: MockBufferGeometry,
    Float32BufferAttribute: vi.fn(),
    BufferAttribute: vi.fn(),
    MeshStandardMaterial: vi.fn(() => ({ dispose: vi.fn(), color: new MockColor() })),
    DoubleSide: 2,
    FrontSide: 0,
    BackSide: 1,
    Shape: vi.fn(() => ({ moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn() })),
    ExtrudeGeometry: vi.fn(() => ({
      translate: vi.fn(),
      dispose: vi.fn(),
      computeVertexNormals: vi.fn(),
    })),
    EdgesGeometry: vi.fn(() => ({ dispose: vi.fn() })),
    LineBasicMaterial: vi.fn(() => ({ dispose: vi.fn() })),
    LineSegments: vi.fn(() => ({ geometry: {}, material: {} })),
    Group: vi.fn(() => ({ add: vi.fn(), children: [] })),
    Mesh: vi.fn(() => ({ geometry: {}, material: {} })),
    Quaternion: vi.fn(() => ({ setFromEuler: vi.fn() })),
    Euler: vi.fn(() => ({})),
    Matrix4: vi.fn(() => ({ compose: vi.fn(), identity: vi.fn() })),
    InstancedMesh: vi.fn(() => ({
      setMatrixAt: vi.fn(),
      setColorAt: vi.fn(),
      instanceMatrix: { needsUpdate: false },
      instanceColor: { needsUpdate: false },
    })),
    Object3D: vi.fn(() => ({
      position: new MockVector3(),
      quaternion: {},
      scale: new MockVector3(1, 1, 1),
      updateMatrix: vi.fn(),
      matrix: {},
    })),
    Box3: vi.fn(() => ({
      min: new MockVector3(),
      max: new MockVector3(),
      setFromObject: vi.fn().mockReturnThis(),
      getSize: vi.fn(() => new MockVector3(1, 1, 1)),
    })),
    OrthographicCamera: vi.fn(() => ({
      position: new MockVector3(),
      zoom: 30,
      updateProjectionMatrix: vi.fn(),
      up: { set: vi.fn() },
    })),
    Spherical: vi.fn(() => ({
      setFromVector3: vi.fn().mockReturnThis(),
      radius: 10,
      phi: 0,
      theta: 0,
    })),
  };
}
