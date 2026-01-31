import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BinDimensions } from './BinDimensions';

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

vi.mock('@react-three/drei', () => ({
  Line: () => <div data-testid="line" />,
  Text: ({ children }: { children: ReactNode }) => <div data-testid="r3f-text">{children}</div>,
}));

describe('BinDimensions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(
      <BinDimensions
        width={2}
        depth={3}
        height={4}
        gridUnitMm={42}
        heightUnitMm={7}
        stackingLip={false}
      />
    );
    expect(screen.getAllByTestId('line').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('r3f-text').length).toBeGreaterThan(0);
  });

  it('renders with stacking lip enabled', () => {
    render(
      <BinDimensions
        width={2}
        depth={3}
        height={4}
        gridUnitMm={42}
        heightUnitMm={7}
        stackingLip={true}
      />
    );
    expect(screen.getAllByTestId('line').length).toBeGreaterThan(0);
  });

  it('renders with fractional dimensions', () => {
    render(
      <BinDimensions
        width={2.5}
        depth={3.5}
        height={4}
        gridUnitMm={42}
        heightUnitMm={7}
        stackingLip={false}
      />
    );
    expect(screen.getAllByTestId('line').length).toBeGreaterThan(0);
  });
});
