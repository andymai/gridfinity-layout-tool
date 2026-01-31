import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BinNameLabel } from './BinNameLabel';

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
  Text: ({ children }: { children: ReactNode }) => <div data-testid="r3f-text">{children}</div>,
}));

describe('BinNameLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing with name', () => {
    render(<BinNameLabel width={2} depth={3} name="Test Bin" />);
    expect(screen.getByTestId('r3f-text')).toHaveTextContent('TEST BIN');
  });

  it('returns null when name is empty', () => {
    const { container } = render(<BinNameLabel width={2} depth={3} name="" />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when name is whitespace', () => {
    const { container } = render(<BinNameLabel width={2} depth={3} name="   " />);
    expect(container.firstChild).toBeNull();
  });

  it('converts name to uppercase', () => {
    render(<BinNameLabel width={2} depth={3} name="lowercase bin" />);
    expect(screen.getByTestId('r3f-text')).toHaveTextContent('LOWERCASE BIN');
  });
});
