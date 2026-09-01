// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { Object3D } from 'three';
import { GlbViewer } from './GlbViewer';

interface GltfTestState {
  impl: () => { scene: Object3D };
  calls: string[];
  setDecoderPath: ReturnType<typeof vi.fn>;
  orbitProps: Record<string, unknown>;
}

const gltfState = vi.hoisted((): GltfTestState => ({
  impl: () => ({ scene: new Group() }),
  calls: [],
  setDecoderPath: vi.fn(),
  orbitProps: {},
}));

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: ReactNode }) => (
    <div data-testid="glb-canvas">{children}</div>
  ),
  useThree: (selector?: (state: unknown) => unknown) => {
    const state = { controls: null, invalidate: () => {}, gl: { domElement: null } };
    return selector ? selector(state) : state;
  },
  useFrame: () => {},
}));

vi.mock('@react-three/drei', () => ({
  useGLTF: Object.assign(
    (url: string) => {
      gltfState.calls.push(url);
      return gltfState.impl();
    },
    { setDecoderPath: gltfState.setDecoderPath }
  ),
  Bounds: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Center: ({ children }: { children?: ReactNode }) => <>{children}</>,
  OrbitControls: (props: Record<string, unknown>) => {
    gltfState.orbitProps = props;
    return null;
  },
  useProgress: () => ({ active: true, progress: 40, errors: [], item: '', loaded: 2, total: 5 }),
}));

const spaceMouseState = vi.hoisted((): { props: Record<string, unknown> } => ({ props: {} }));
vi.mock('@/shared/spacemouse/components/SpaceMouseController', () => ({
  SpaceMouseController: (props: Record<string, unknown>) => {
    spaceMouseState.props = props;
    return null;
  },
}));

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const reducedMotion = vi.hoisted(() => ({ value: false }));
vi.mock('@/shared/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => reducedMotion.value,
}));

const defaultProps = {
  meshUrl: '/models/example.glb',
  posterUrl: '/thumbs/example.png',
  alt: 'Example bin',
};

describe('GlbViewer', () => {
  beforeEach(() => {
    gltfState.impl = () => ({ scene: new Group() });
    gltfState.calls = [];
    gltfState.orbitProps = {};
    spaceMouseState.props = {};
    reducedMotion.value = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers the self-hosted draco decoder path once at module scope', () => {
    expect(gltfState.setDecoderPath).toHaveBeenCalledWith('/draco/');
  });

  it('shows the poster at full opacity with loading progress before the model resolves', () => {
    gltfState.impl = () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- suspend forever, the React Suspense protocol
      throw new Promise(() => {
        /* never resolves */
      });
    };
    render(<GlbViewer {...defaultProps} />);

    const poster = screen.getByAltText('Example bin');
    expect(poster).toHaveClass('opacity-100');
    expect(poster).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByTestId('glb-canvas')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'glbViewer.loading' })).toBeInTheDocument();
  });

  it('fades the poster out once the model is ready', () => {
    render(<GlbViewer {...defaultProps} />);

    const poster = screen.getByAltText('Example bin');
    expect(poster).toHaveClass('opacity-0');
    expect(poster).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('gives a normal-less loaded scene computed normals before the first paint', () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3)
    );
    const material = new MeshStandardMaterial({ flatShading: true });
    const scene = new Group();
    scene.add(new Mesh(geometry, material));
    gltfState.impl = () => ({ scene });

    render(<GlbViewer {...defaultProps} />);

    // Without these the GPU derives the normal per fragment and NaNs out on
    // sliver triangles, speckling the model with white pixels.
    expect(geometry.hasAttribute('normal')).toBe(true);
    expect(material.flatShading).toBe(false);
  });

  it('notifies onModelReady when the model resolves, not before', () => {
    gltfState.impl = () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- suspend forever, the React Suspense protocol
      throw new Promise(() => {
        /* never resolves */
      });
    };
    const pendingReady = vi.fn();
    render(<GlbViewer {...defaultProps} onModelReady={pendingReady} />);
    expect(pendingReady).not.toHaveBeenCalled();

    gltfState.impl = () => ({ scene: new Group() });
    const onModelReady = vi.fn();
    render(<GlbViewer {...defaultProps} onModelReady={onModelReady} />);
    expect(onModelReady).toHaveBeenCalledTimes(1);
  });

  it('does not mount the canvas or fetch the mesh until tapped', () => {
    render(<GlbViewer {...defaultProps} loadBehavior="tap" />);

    expect(screen.queryByTestId('glb-canvas')).not.toBeInTheDocument();
    expect(gltfState.calls).toHaveLength(0);
    expect(screen.getByAltText('Example bin')).toHaveClass('opacity-100');

    fireEvent.click(screen.getByRole('button', { name: 'glbViewer.show3d' }));

    expect(screen.getByTestId('glb-canvas')).toBeInTheDocument();
    expect(gltfState.calls).toContain('/models/example.glb');
    expect(screen.queryByRole('button', { name: 'glbViewer.show3d' })).not.toBeInTheDocument();
  });

  it('keeps the poster and shows an error message when the model fails to load', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {
      /* React logs caught boundary errors */
    });
    gltfState.impl = () => {
      throw new Error('fetch failed');
    };
    render(<GlbViewer {...defaultProps} />);

    const poster = screen.getByAltText('Example bin');
    expect(poster).toHaveClass('opacity-100');
    expect(poster).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByText('glbViewer.loadFailed')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('auto-rotates by default and stops under prefers-reduced-motion', () => {
    const { unmount } = render(<GlbViewer {...defaultProps} />);
    expect(gltfState.orbitProps.autoRotate).toBe(true);
    unmount();

    reducedMotion.value = true;
    render(<GlbViewer {...defaultProps} />);
    expect(gltfState.orbitProps.autoRotate).toBe(false);
  });

  it('lets callers disable auto-rotate', () => {
    render(<GlbViewer {...defaultProps} autoRotate={false} />);
    expect(gltfState.orbitProps.autoRotate).toBe(false);
  });

  it('does not claim the SpaceMouse by default', () => {
    render(<GlbViewer {...defaultProps} />);
    expect(spaceMouseState.props.modal).toBe(false);
  });

  it('claims the SpaceMouse when hosted in a modal, so the covered canvas stops moving', () => {
    render(<GlbViewer {...defaultProps} modal />);
    expect(spaceMouseState.props.modal).toBe(true);
  });
});
