import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CutoutShapeBadge } from './CutoutShapeBadge';
import type { Cutout } from '@/features/bin-designer/types';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

function c(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'c1',
    shape: 'slot',
    x: 0,
    y: 0,
    width: 30,
    depth: 12,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

describe('CutoutShapeBadge', () => {
  it('names a slot distinctly (not a rectangle)', () => {
    render(<CutoutShapeBadge cutout={c({ shape: 'slot' })} />);
    expect(screen.getByText('binDesigner.cutouts.addSlot')).toBeInTheDocument();
  });

  it('shows the side count for a polygon', () => {
    render(<CutoutShapeBadge cutout={c({ shape: 'polygon', sides: 8 })} />);
    expect(screen.getByText('binDesigner.cutouts.addPolygon')).toBeInTheDocument();
    expect(screen.getByText('· 8')).toBeInTheDocument();
  });

  it('uses the path name for path cutouts', () => {
    render(<CutoutShapeBadge cutout={c({ shape: 'path' })} />);
    expect(screen.getByText('binDesigner.cutouts.shapeName.path')).toBeInTheDocument();
  });
});
