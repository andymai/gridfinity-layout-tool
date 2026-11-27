import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { MeshData } from '@/shared/types/generation';
import { SpinningBin } from './SpinningBin';

// jsdom has no WebGL; the canvas is checked in the browser pass, not here.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, frameloop }: { children: ReactNode; frameloop: string }) => (
    <div data-testid="canvas" data-frameloop={frameloop}>
      {children}
    </div>
  ),
}));

const mesh: MeshData = {
  vertices: new Float32Array(0),
  normals: new Float32Array(0),
  indices: new Uint32Array(0),
  edgeVertices: new Float32Array(0),
  triangleCount: 0,
};

describe('SpinningBin', () => {
  it('names the bin for screen readers', () => {
    render(<SpinningBin mesh={mesh} turnSeconds={0} label="Tool caddy" />);
    expect(screen.getByRole('img', { name: 'Tool caddy' })).toBeInTheDocument();
  });

  it('draws only when the card time changes, so a pause stops the bin', () => {
    render(<SpinningBin mesh={mesh} turnSeconds={2} label="Tool caddy" />);
    expect(screen.getByTestId('canvas')).toHaveAttribute('data-frameloop', 'demand');
  });
});
