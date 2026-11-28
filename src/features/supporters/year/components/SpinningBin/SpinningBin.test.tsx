import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { MeshData } from '@/shared/types/generation';
import type { ModelLook } from '../../cards/scene';
import { SpinningBin } from './SpinningBin';

// jsdom has no WebGL; the canvas is checked in the browser pass, not here.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({
    children,
    frameloop,
    flat,
  }: {
    children: ReactNode;
    frameloop: string;
    flat?: boolean;
  }) => (
    <div data-testid="canvas" data-frameloop={frameloop} data-flat={String(Boolean(flat))}>
      {children}
    </div>
  ),
  useThree: (select: (state: object) => unknown) =>
    select({
      set: () => undefined,
      invalidate: () => undefined,
      size: { width: 300, height: 200 },
    }),
}));

const mesh: MeshData = {
  vertices: new Float32Array(0),
  normals: new Float32Array(0),
  indices: new Uint32Array(0),
  edgeVertices: new Float32Array(0),
  triangleCount: 0,
};

const look: ModelLook = {
  tint: '#7350F0',
  edge: '#1E0A4F',
  edgeOpacity: 0.5,
  sky: '#FFFFFF',
  ground: '#1E0A4F',
  rim: '#B49CFF',
  fov: 24,
  elevation: 28,
  fit: 0.72,
};

describe('SpinningBin', () => {
  it('names the bin for screen readers', () => {
    render(<SpinningBin mesh={mesh} look={look} angle={0} resolution={1} label="Tool caddy" />);
    expect(screen.getByRole('img', { name: 'Tool caddy' })).toBeInTheDocument();
  });

  it('draws only when the card time changes, in the colours it is given', () => {
    render(<SpinningBin mesh={mesh} look={look} angle={20} resolution={1} label="Tool caddy" />);
    const canvas = screen.getByTestId('canvas');
    expect(canvas).toHaveAttribute('data-frameloop', 'demand');
    // No tone mapping, so the tint lands as the card's own hue.
    expect(canvas).toHaveAttribute('data-flat', 'true');
  });
});
