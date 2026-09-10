import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { DimensionLine } from './DimensionLine';

vi.mock('@react-three/drei', () => ({
  Line: ({ points }: { points: unknown[] }) => (
    <div data-testid="line" data-points={points.length} />
  ),
  Text: ({ children, rotation }: { children: ReactNode; rotation?: number[] }) => (
    <div data-testid="r3f-text" data-rotation={rotation?.join(',')}>
      {children}
    </div>
  ),
}));

const STYLE = { color: '#abc', fontSize: 1, lineOpacity: 0.5, textOpacity: 0.7 };

describe('DimensionLine', () => {
  it('draws the line, both end caps and the label', () => {
    render(
      <DimensionLine
        start={[0, 0, 0]}
        end={[10, 0, 0]}
        endCaps={[
          [
            [0, -1, 0],
            [0, 1, 0],
          ],
          [
            [10, -1, 0],
            [10, 1, 0],
          ],
        ]}
        labelPos={[5, -2, 0]}
        label="10mm"
        anchorX="center"
        anchorY="top"
        {...STYLE}
      />
    );

    expect(screen.getAllByTestId('line')).toHaveLength(3);
    expect(screen.getByTestId('r3f-text')).toHaveTextContent('10mm');
    expect(screen.getByTestId('r3f-text').dataset.rotation).toBeUndefined();
  });

  it('passes a rotation through only when given', () => {
    render(
      <DimensionLine
        start={[0, 0, 0]}
        end={[0, 10, 0]}
        endCaps={[
          [
            [-1, 0, 0],
            [1, 0, 0],
          ],
          [
            [-1, 10, 0],
            [1, 10, 0],
          ],
        ]}
        labelPos={[-2, 5, 0]}
        label="10mm"
        anchorX="right"
        anchorY="middle"
        rotation={[0, 0, Math.PI / 2]}
        {...STYLE}
      />
    );

    expect(screen.getByTestId('r3f-text').dataset.rotation).toBe(`0,0,${Math.PI / 2}`);
  });
});
