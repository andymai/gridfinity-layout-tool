import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BentoMiniPreview } from './BentoMiniPreview';
import { createUniformGrid } from '@/features/bin-designer/utils/compartments';
import { drawCompartment } from '@/features/bin-designer/utils/bentoDraw';

describe('BentoMiniPreview', () => {
  it('renders only the lattice for an undrawn grid', () => {
    render(<BentoMiniPreview compartments={createUniformGrid(4, 3, 1.2)} aspectRatio={1} />);

    const svg = screen.getByTestId('bento-mini-preview');
    expect(svg.querySelectorAll('line')).toHaveLength(3 + 2);
    expect(svg.querySelectorAll('rect')).toHaveLength(0);
  });

  it('renders a block per drawn compartment', () => {
    const first = drawCompartment(createUniformGrid(4, 3, 1.2), { col: 0, row: 0, w: 2, h: 2 });
    if (!first) throw new Error('unreachable');
    const second = drawCompartment(first.config, { col: 2, row: 2, w: 2, h: 1 });
    if (!second) throw new Error('unreachable');

    render(<BentoMiniPreview compartments={second.config} aspectRatio={1} />);

    expect(screen.getByTestId('bento-mini-preview').querySelectorAll('rect')).toHaveLength(2);
  });

  it('clamps extreme aspect ratios to a usable thumbnail', () => {
    render(<BentoMiniPreview compartments={createUniformGrid(2, 2, 1.2)} aspectRatio={100} />);

    const viewBox = screen.getByTestId('bento-mini-preview').getAttribute('viewBox');
    expect(viewBox).toBe('0 0 120 30');
  });
});
