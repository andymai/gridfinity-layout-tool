import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useDesignerStore } from '../../store';
import { DEFAULT_BIN_PARAMS } from '../../constants';

// Mock Three.js rendering (jsdom has no WebGL)
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) => (
    <div data-testid="r3f-canvas">{children}</div>
  ),
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
}));

vi.mock('three', () => {
  function BufferGeometry() { /* mock */ }
  BufferGeometry.prototype.setAttribute = function () { return this; };
  BufferGeometry.prototype.dispose = function () { /* noop */ };

  function Float32BufferAttribute(array: Float32Array, _itemSize: number) {
    return { array };
  }

  function Vector3(x = 0, y = 0, z = 0) {
    return { x, y, z };
  }

  return { Vector3, BufferGeometry, Float32BufferAttribute, DoubleSide: 2 };
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
        error: null,
        timingMs: 0,
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
      generation: { status: 'idle', mesh: null, error: null, timingMs: 0 },
    });
    render(<PreviewCanvas />);

    expect(screen.getByText('Loading preview...')).toBeInTheDocument();
  });

  it('shows skeleton when generating with no prior mesh', () => {
    useDesignerStore.setState({
      wasmStatus: 'ready',
      generation: { status: 'generating', mesh: null, error: null, timingMs: 0 },
    });
    render(<PreviewCanvas />);

    expect(screen.getByText('Generating mesh...')).toBeInTheDocument();
  });

  it('shows skeleton when generation has error with no mesh', () => {
    useDesignerStore.setState({
      wasmStatus: 'ready',
      generation: { status: 'error', mesh: null, error: 'Failed', timingMs: 0 },
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
        },
        error: null,
        timingMs: 50,
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
        },
        error: null,
        timingMs: 50,
      },
    });
    render(<PreviewCanvas />);

    expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument();
    expect(screen.getByText('Updating…')).toBeInTheDocument();
  });

  it('does not show updating overlay when generation is complete', () => {
    useDesignerStore.setState({
      wasmStatus: 'ready',
      generation: {
        status: 'complete',
        mesh: {
          vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
        },
        error: null,
        timingMs: 50,
      },
    });
    render(<PreviewCanvas />);

    expect(screen.queryByText('Updating...')).not.toBeInTheDocument();
  });

  it('renders preview control buttons when mesh is available', () => {
    useDesignerStore.setState({
      wasmStatus: 'ready',
      generation: {
        status: 'complete',
        mesh: {
          vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
        },
        error: null,
        timingMs: 50,
      },
    });
    render(<PreviewCanvas />);

    expect(screen.getByLabelText('Front camera view')).toBeInTheDocument();
    expect(screen.getByLabelText('Reset camera view')).toBeInTheDocument();
    expect(screen.getByLabelText('Toggle wireframe mode')).toBeInTheDocument();
  });
});
