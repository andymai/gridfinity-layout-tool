import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { MeshData } from '@/shared/types/generation';
import { SpinningBin } from './SpinningBin';

// jsdom has no WebGL; the canvas is checked in the browser pass, not here.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) => <div data-testid="canvas">{children}</div>,
  useFrame: () => {},
}));
vi.mock('@react-three/drei', () => ({ Center: () => null }));

const mesh: MeshData = {
  vertices: new Float32Array(0),
  normals: new Float32Array(0),
  indices: new Uint32Array(0),
  edgeVertices: new Float32Array(0),
  triangleCount: 0,
};

describe('SpinningBin', () => {
  it('names the bin for screen readers', () => {
    render(<SpinningBin mesh={mesh} spin label="Tool caddy" />);
    expect(screen.getByRole('img', { name: 'Tool caddy' })).toBeInTheDocument();
    expect(screen.getByTestId('canvas')).toBeInTheDocument();
  });
});
