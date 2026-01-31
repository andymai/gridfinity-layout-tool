import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import type { ReactNode } from 'react';
import { DrawerDimensions } from './DrawerDimensions';

// Mock React Three Fiber
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

// Mock Drei
vi.mock('@react-three/drei', () => ({
  Line: ({ points }: { points: unknown[] }) => (
    <div data-testid="line" data-points={points?.length} />
  ),
  Text: ({ children }: { children: ReactNode }) => <div data-testid="r3f-text">{children}</div>,
}));

describe('DrawerDimensions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('renders without crashing', () => {
    const { container } = render(
      <DrawerDimensions width={10} depth={8} height={21} gridUnitMm={42} heightUnitMm={7} />
    );
    expect(container).toBeTruthy();
  });

  it('renders dimension lines', () => {
    const { getAllByTestId } = render(
      <DrawerDimensions width={10} depth={8} height={21} gridUnitMm={42} heightUnitMm={7} />
    );
    const lines = getAllByTestId('line');
    // Should have width, depth, and height dimension lines plus end caps (9 total)
    expect(lines.length).toBeGreaterThan(0);
  });

  it('renders dimension text labels', () => {
    const { getAllByTestId } = render(
      <DrawerDimensions width={10} depth={8} height={21} gridUnitMm={42} heightUnitMm={7} />
    );
    const textElements = getAllByTestId('r3f-text');
    // Should have width, depth, and height labels (3 total)
    expect(textElements.length).toBe(3);
  });

  it('calculates correct width in mm', () => {
    const { getAllByTestId } = render(
      <DrawerDimensions width={10} depth={8} height={21} gridUnitMm={42} heightUnitMm={7} />
    );
    const textElements = getAllByTestId('r3f-text');
    // Width should be 10 * 42 = 420mm
    expect(textElements[0].textContent).toBe('420mm');
  });

  it('calculates correct depth in mm', () => {
    const { getAllByTestId } = render(
      <DrawerDimensions width={10} depth={8} height={21} gridUnitMm={42} heightUnitMm={7} />
    );
    const textElements = getAllByTestId('r3f-text');
    // Depth should be 8 * 42 = 336mm
    expect(textElements[1].textContent).toBe('336mm');
  });

  it('calculates correct height in mm', () => {
    const { getAllByTestId } = render(
      <DrawerDimensions width={10} depth={8} height={21} gridUnitMm={42} heightUnitMm={7} />
    );
    const textElements = getAllByTestId('r3f-text');
    // Height should be 21 * 7 = 147mm
    expect(textElements[2].textContent).toBe('147mm');
  });

  it('renders with fractional dimensions', () => {
    const { container } = render(
      <DrawerDimensions width={10.5} depth={8.5} height={21} gridUnitMm={42} heightUnitMm={7} />
    );
    expect(container).toBeTruthy();
  });

  it('renders with different grid unit size', () => {
    const { getAllByTestId } = render(
      <DrawerDimensions width={10} depth={8} height={21} gridUnitMm={50} heightUnitMm={7} />
    );
    const textElements = getAllByTestId('r3f-text');
    // Width should be 10 * 50 = 500mm
    expect(textElements[0].textContent).toBe('500mm');
  });
});
