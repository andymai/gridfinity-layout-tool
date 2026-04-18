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

interface MockTextProps {
  children: ReactNode;
  fontSize?: number;
  maxWidth?: number;
}

vi.mock('@react-three/drei', () => ({
  Text: ({ children, fontSize, maxWidth }: MockTextProps) => (
    <div data-testid="r3f-text" data-font-size={fontSize} data-max-width={maxWidth ?? 'none'}>
      {children}
    </div>
  ),
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

  it('uses default font size (7mm) for short names that fit', () => {
    render(<BinNameLabel width={2} depth={3} name="Bin" />);
    const text = screen.getByTestId('r3f-text');
    expect(text.dataset.fontSize).toBe('7');
    expect(text.dataset.maxWidth).toBe('none');
  });

  it('shrinks font size for medium-long names on a small bin', () => {
    // 25 chars × 7mm × 0.68 ≈ 119mm, exceeds the 100mm floor → shrink.
    // Ideal: 100 / (25 × 0.68) ≈ 5.88mm, which is above the 5mm minimum.
    render(<BinNameLabel width={1} depth={1} name="Screws M3 x 12mm Flat Set" />);
    const text = screen.getByTestId('r3f-text');
    const fontSize = Number(text.dataset.fontSize);
    expect(fontSize).toBeGreaterThanOrEqual(5);
    expect(fontSize).toBeLessThan(7);
    expect(text.dataset.maxWidth).toBe('none');
  });

  it('falls back to 2-line wrap for very long names on a small bin', () => {
    const veryLongName = 'A very long name that exceeds the minimum font size threshold';
    render(<BinNameLabel width={1} depth={1} name={veryLongName} />);
    const text = screen.getByTestId('r3f-text');
    expect(text.dataset.fontSize).toBe('7');
    expect(text.dataset.maxWidth).not.toBe('none');
    expect(Number(text.dataset.maxWidth)).toBeGreaterThan(0);
  });

  it('honors the 100mm minimum available width on tiny bins', () => {
    // 1x1 bin is 42mm wide → outerW * 1.5 = 63mm, floor raises it to 100mm.
    // A 15-char name at 7mm ≈ 71mm — fits in 100mm but not in 63mm.
    render(<BinNameLabel width={1} depth={1} name="SCREWS M3 SHORT" />);
    const text = screen.getByTestId('r3f-text');
    expect(text.dataset.fontSize).toBe('7');
    expect(text.dataset.maxWidth).toBe('none');
  });
});
