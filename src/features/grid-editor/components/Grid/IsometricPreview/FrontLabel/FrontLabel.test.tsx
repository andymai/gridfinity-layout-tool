import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import type { ReactNode } from 'react';
import { FrontLabel } from './FrontLabel';

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

describe('FrontLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('renders without crashing', () => {
    const { container } = render(<FrontLabel drawerWidth={10} label="My Layout" />);
    expect(container).toBeTruthy();
  });

  it('renders text label in uppercase', () => {
    const { getByTestId } = render(<FrontLabel drawerWidth={10} label="My Layout" />);
    const textElement = getByTestId('r3f-text');
    expect(textElement.textContent).toBe('MY LAYOUT');
  });

  it('renders underline', () => {
    const { getByTestId } = render(<FrontLabel drawerWidth={10} label="My Layout" />);
    const line = getByTestId('line');
    expect(line).toBeTruthy();
  });

  it('renders with short label', () => {
    const { getByTestId } = render(<FrontLabel drawerWidth={10} label="A" />);
    const textElement = getByTestId('r3f-text');
    expect(textElement.textContent).toBe('A');
  });

  it('renders with long label', () => {
    const { getByTestId } = render(
      <FrontLabel drawerWidth={10} label="This is a very long layout name" />
    );
    const textElement = getByTestId('r3f-text');
    expect(textElement.textContent).toBe('THIS IS A VERY LONG LAYOUT NAME');
  });

  it('renders with different drawer widths', () => {
    const { container } = render(<FrontLabel drawerWidth={5} label="Small" />);
    expect(container).toBeTruthy();
  });

  it('renders with empty label', () => {
    const { getByTestId } = render(<FrontLabel drawerWidth={10} label="" />);
    const textElement = getByTestId('r3f-text');
    expect(textElement.textContent).toBe('');
  });
});
