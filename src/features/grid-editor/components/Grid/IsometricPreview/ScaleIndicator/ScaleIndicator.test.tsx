import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import type { ReactNode } from 'react';
import { ScaleIndicator } from './ScaleIndicator';

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

describe('ScaleIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('renders without crashing', () => {
    const { container } = render(<ScaleIndicator gridUnitMm={42} drawerDepth={8} />);
    expect(container).toBeTruthy();
  });

  it('renders scale lines', () => {
    const { getAllByTestId } = render(<ScaleIndicator gridUnitMm={42} drawerDepth={8} />);
    const lines = getAllByTestId('line');
    // Should have 3 lines: main line + 2 tick marks
    expect(lines.length).toBe(3);
  });

  it('renders scale label text', () => {
    const { getByTestId } = render(<ScaleIndicator gridUnitMm={42} drawerDepth={8} />);
    const textElement = getByTestId('r3f-text');
    expect(textElement).toBeTruthy();
  });

  it('displays correct label for standard grid unit', () => {
    const { getByTestId } = render(<ScaleIndicator gridUnitMm={42} drawerDepth={8} />);
    const textElement = getByTestId('r3f-text');
    expect(textElement.textContent).toBe('1 unit = 42mm');
  });

  it('displays correct label for different grid unit', () => {
    const { getByTestId } = render(<ScaleIndicator gridUnitMm={50} drawerDepth={8} />);
    const textElement = getByTestId('r3f-text');
    expect(textElement.textContent).toBe('1 unit = 50mm');
  });

  it('renders with different drawer depths', () => {
    const { container } = render(<ScaleIndicator gridUnitMm={42} drawerDepth={15} />);
    expect(container).toBeTruthy();
  });

  it('renders with small drawer depth', () => {
    const { container } = render(<ScaleIndicator gridUnitMm={42} drawerDepth={2} />);
    expect(container).toBeTruthy();
  });
});
