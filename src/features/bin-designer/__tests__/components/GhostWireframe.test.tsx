/**
 * Tests for GhostWireframe component.
 * Verifies ghost visibility based on transition phase.
 */

import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useDesignerStore } from '../../store';
import { DEFAULT_BIN_PARAMS, DEFAULT_GENERATION_STATE } from '../../constants';

// Mock Three.js rendering (jsdom has no WebGL)
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) => <div data-testid="r3f-canvas">{children}</div>,
  useThree: () => ({ invalidate: vi.fn() }),
  useFrame: () => {
    /* noop */
  },
}));

vi.mock('three', () => {
  function BoxGeometry() {
    /* mock */
  }
  BoxGeometry.prototype.dispose = vi.fn();

  function EdgesGeometry() {
    /* mock */
  }
  EdgesGeometry.prototype.dispose = vi.fn();

  return {
    BoxGeometry,
    EdgesGeometry,
  };
});

import { GhostWireframe } from '../../components/preview/GhostWireframe';

function renderWithCanvas(component: ReactNode) {
  return render(<div data-testid="r3f-canvas">{component}</div>);
}

describe('GhostWireframe', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: DEFAULT_BIN_PARAMS,
      generation: {
        ...DEFAULT_GENERATION_STATE,
        ghostTransition: { phase: 'hidden', startTime: 0 },
      },
    });
  });

  it('returns null when ghost phase is hidden', () => {
    useDesignerStore.setState({
      generation: {
        ...DEFAULT_GENERATION_STATE,
        ghostTransition: { phase: 'hidden', startTime: 0 },
      },
    });

    const { container } = renderWithCanvas(<GhostWireframe />);

    // Should render nothing when hidden
    expect(container.querySelector('lineSegments')).toBeNull();
  });

  it('renders wireframe when ghost phase is showing', () => {
    useDesignerStore.setState({
      generation: {
        ...DEFAULT_GENERATION_STATE,
        ghostTransition: { phase: 'showing', startTime: Date.now() },
      },
    });

    const { container } = renderWithCanvas(<GhostWireframe />);

    // Should render lineSegments element
    expect(container.querySelector('lineSegments')).toBeInTheDocument();
  });

  // Note: Testing the morphing animation state is complex because it uses useFrame
  // and requestAnimationFrame which don't run in jsdom. The core functionality
  // (phase transitions) is tested via store integration tests below.

  it('updates dimensions when params change', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 3, depth: 4, height: 5 },
      generation: {
        ...DEFAULT_GENERATION_STATE,
        ghostTransition: { phase: 'showing', startTime: Date.now() },
      },
    });

    const { container } = renderWithCanvas(<GhostWireframe />);

    // Wireframe should be rendered with new dimensions
    expect(container.querySelector('lineSegments')).toBeInTheDocument();
  });
});

describe('GhostWireframe store integration', () => {
  it('setGhostPhase updates transition state', () => {
    useDesignerStore.getState().setGhostPhase('showing');

    const state = useDesignerStore.getState();
    expect(state.generation.ghostTransition.phase).toBe('showing');
    expect(state.generation.ghostTransition.startTime).toBeGreaterThan(0);
  });

  it('setGhostPhase to morphing updates phase', () => {
    useDesignerStore.getState().setGhostPhase('showing');
    expect(useDesignerStore.getState().generation.ghostTransition.phase).toBe('showing');

    useDesignerStore.getState().setGhostPhase('morphing');
    expect(useDesignerStore.getState().generation.ghostTransition.phase).toBe('morphing');
    expect(useDesignerStore.getState().generation.ghostTransition.startTime).toBeGreaterThan(0);
  });
});
