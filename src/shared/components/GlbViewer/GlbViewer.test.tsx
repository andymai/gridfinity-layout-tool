// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GlbViewer } from './GlbViewer';

interface GltfTestState {
  impl: () => { scene: Record<string, unknown> };
  calls: string[];
  setDecoderPath: ReturnType<typeof vi.fn>;
  orbitProps: Record<string, unknown>;
}

const gltfState = vi.hoisted((): GltfTestState => ({
  impl: () => ({ scene: {} }),
  calls: [],
  setDecoderPath: vi.fn(),
  orbitProps: {},
}));

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: ReactNode }) => (
    <div data-testid="glb-canvas">{children}</div>
  ),
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

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

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
    gltfState.impl = () => ({ scene: {} });
    gltfState.calls = [];
    gltfState.orbitProps = {};
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

    gltfState.impl = () => ({ scene: {} });
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
});
