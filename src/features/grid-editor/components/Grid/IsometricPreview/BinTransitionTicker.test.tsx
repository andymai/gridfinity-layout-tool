import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { BinTransitionTicker } from './BinTransitionTicker';

// Mock React Three Fiber
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useFrame: vi.fn(),
  extend: vi.fn(),
}));

describe('BinTransitionTicker', () => {
  it('renders without crashing', () => {
    const tick = vi.fn(() => false);
    const { container } = render(<BinTransitionTicker tick={tick} />);
    expect(container).toBeTruthy();
  });

  it('registers a useFrame callback', async () => {
    const r3f = await import('@react-three/fiber');
    const useFrameMock = r3f.useFrame as ReturnType<typeof vi.fn>;
    const tick = vi.fn(() => false);
    render(<BinTransitionTicker tick={tick} />);
    expect(useFrameMock).toHaveBeenCalled();
  });
});
