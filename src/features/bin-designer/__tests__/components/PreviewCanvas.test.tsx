import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useDesignerStore } from '../../store';
import { DEFAULT_BIN_PARAMS } from '../../constants';

// Mock Three.js rendering (jsdom has no WebGL)
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) => <div data-testid="r3f-canvas">{children}</div>,
  useThree: () => ({
    camera: {
      position: {
        clone: () => ({
          x: 0,
          y: 0,
          z: 0,
          sub: () => ({ x: 0, y: 0, z: 0 }),
          normalize: () => ({ x: 0, y: 0, z: 1 }),
        }),
        copy: vi.fn(),
        set: vi.fn(),
        lerpVectors: vi.fn(),
      },
      up: { set: vi.fn() },
      lookAt: vi.fn(),
    },
    invalidate: vi.fn(),
  }),
  useFrame: () => {
    /* noop */
  },
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
  ContactShadows: () => <div data-testid="contact-shadows" />,
  Line: () => <div data-testid="line" />,
  Text: ({ children }: { children: ReactNode }) => <div data-testid="text">{children}</div>,
}));

vi.mock('three', () => {
  function BufferGeometry() {
    /* mock */
  }
  BufferGeometry.prototype.setAttribute = function () {
    return this;
  };
  BufferGeometry.prototype.dispose = function () {
    /* noop */
  };

  function Float32BufferAttribute(array: Float32Array, _itemSize: number) {
    return { array };
  }

  function Vector3(x = 0, y = 0, z = 0) {
    return {
      x,
      y,
      z,
      normalize: function () {
        return this;
      },
      multiplyScalar: function () {
        return this;
      },
      add: function () {
        return this;
      },
      clone: function () {
        return {
          x,
          y,
          z,
          sub: () => ({ x: 0, y: 0, z: 0 }),
          normalize: () => ({ x: 0, y: 0, z: 1 }),
        };
      },
      copy: function () {
        return this;
      },
      sub: function () {
        return this;
      },
      set: function () {
        return this;
      },
      setFromSpherical: function () {
        return this;
      },
      lerpVectors: function () {
        return this;
      },
    };
  }

  function Spherical(_r = 0, _phi = 0, _theta = 0) {
    return {
      radius: _r,
      phi: _phi,
      theta: _theta,
      setFromVector3: function () {
        return this;
      },
    };
  }

  function Color(hex?: string) {
    return {
      r: 0.8,
      g: 0.8,
      b: 0.8,
      getHSL: function (target: { h: number; s: number; l: number }) {
        target.h = 0;
        target.s = 0;
        target.l = 0.8;
        return target;
      },
      setHSL: function () {
        return this;
      },
      _hex: hex,
    };
  }

  function ShaderMaterial() {
    return { uniforms: {}, dispose: vi.fn() };
  }

  function Vector2(x = 0, y = 0) {
    return { x, y };
  }

  return {
    Vector2,
    Vector3,
    Spherical,
    BufferGeometry,
    Float32BufferAttribute,
    Color,
    ShaderMaterial,
    FrontSide: 0,
    DoubleSide: 2,
  };
});

vi.mock('three-stdlib', () => ({
  OrbitControls: vi.fn(),
}));

// Mock the generation hook to avoid worker initialization
vi.mock('../../hooks/useGeneration', () => ({
  useGeneration: vi.fn(),
}));

import { PreviewCanvas } from '../../components/PreviewCanvas';

describe('PreviewCanvas', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: DEFAULT_BIN_PARAMS,
      wasmStatus: 'idle',
      generation: {
        status: 'idle',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
    });
  });

  it('shows skeleton when WASM is loading', () => {
    useDesignerStore.setState({ wasmStatus: 'loading' });
    render(<PreviewCanvas />);

    expect(screen.getByText('Initializing engine...')).toBeInTheDocument();
  });

  it('shows skeleton when WASM has error', () => {
    useDesignerStore.setState({ wasmStatus: 'error' });
    render(<PreviewCanvas />);

    expect(screen.getByText('Engine failed to load')).toBeInTheDocument();
  });

  it('shows skeleton when no mesh is available', () => {
    useDesignerStore.setState({
      wasmStatus: 'ready',
      generation: { status: 'idle', mesh: null, progress: 0, epoch: 0 },
    });
    render(<PreviewCanvas />);

    expect(screen.getByText('Loading preview...')).toBeInTheDocument();
  });

  it('shows skeleton when generating with no prior mesh', () => {
    useDesignerStore.setState({
      wasmStatus: 'ready',
      generation: { status: 'generating', mesh: null, progress: 0, epoch: 0 },
    });
    render(<PreviewCanvas />);

    expect(screen.getByText('Generating mesh...')).toBeInTheDocument();
  });

  it('shows skeleton when generation has error with no mesh', () => {
    useDesignerStore.setState({
      wasmStatus: 'ready',
      generation: { status: 'error', mesh: null, progress: 0, epoch: 0 },
    });
    render(<PreviewCanvas />);

    expect(screen.getByText('Generation failed')).toBeInTheDocument();
  });

  it('renders canvas when mesh is available', () => {
    useDesignerStore.setState({
      wasmStatus: 'ready',
      generation: {
        status: 'complete',
        mesh: {
          vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
          error: null,
          timingMs: 50,
        },
        progress: 0,
        epoch: 0,
      },
    });
    render(<PreviewCanvas />);

    expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument();
    expect(screen.queryByText('Loading preview...')).not.toBeInTheDocument();
  });

  it('shows updating overlay when regenerating with existing mesh', () => {
    useDesignerStore.setState({
      wasmStatus: 'ready',
      generation: {
        status: 'generating',
        mesh: {
          vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
          error: null,
          timingMs: 50,
        },
        progress: 0,
        epoch: 0,
      },
    });
    render(<PreviewCanvas />);

    expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument();
    expect(screen.getByText('Updating')).toBeInTheDocument();
  });

  it('does not show updating overlay when generation is complete', () => {
    useDesignerStore.setState({
      wasmStatus: 'ready',
      generation: {
        status: 'complete',
        mesh: {
          vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
          error: null,
          timingMs: 50,
        },
        progress: 0,
        epoch: 0,
      },
    });
    render(<PreviewCanvas />);

    expect(screen.queryByText('Updating')).not.toBeInTheDocument();
  });

  it('renders preview control buttons when mesh is available', () => {
    useDesignerStore.setState({
      wasmStatus: 'ready',
      generation: {
        status: 'complete',
        mesh: {
          vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
          error: null,
          timingMs: 50,
        },
        progress: 0,
        epoch: 0,
      },
    });
    render(<PreviewCanvas />);

    // Desktop and mobile controls both render in DOM (visibility is CSS-based)
    expect(
      screen.getAllByLabelText('Front camera view, keyboard shortcut 1').length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByLabelText('Reset camera view, keyboard shortcut R').length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByLabelText('Toggle wireframe mode, keyboard shortcut W').length
    ).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Change preview color').length).toBeGreaterThan(0);
  });
});
