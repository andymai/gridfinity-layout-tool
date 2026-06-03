import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CutoutShapeControls } from './CutoutShapeControls';
import type { Cutout } from '@/features/bin-designer/types';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

function makeCutout(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'c1',
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 20,
    depth: 20,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

function renderControls(cutout: Cutout) {
  return render(
    <CutoutShapeControls cutout={cutout} maxWidth={100} maxDepth={100} onUpdate={vi.fn()} />
  );
}

describe('CutoutShapeControls', () => {
  it('shows sides, across-flats and clearance for a polygon', () => {
    renderControls(makeCutout({ shape: 'polygon', sides: 6 }));
    expect(screen.getByText('binDesigner.cutouts.sides')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.acrossFlats')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.clearance')).toBeInTheDocument();
  });

  it('shows clearance but not sides for a circle', () => {
    renderControls(makeCutout({ shape: 'circle' }));
    expect(screen.getByText('binDesigner.cutouts.clearance')).toBeInTheDocument();
    expect(screen.queryByText('binDesigner.cutouts.sides')).not.toBeInTheDocument();
  });

  it('shows clearance for a slot', () => {
    renderControls(makeCutout({ shape: 'slot', width: 30, depth: 12 }));
    expect(screen.getByText('binDesigner.cutouts.clearance')).toBeInTheDocument();
  });

  it('offers an entry chamfer for a rectangle but no clearance or sides', () => {
    renderControls(makeCutout({ shape: 'rectangle' }));
    expect(screen.getByText('binDesigner.cutouts.chamfer')).toBeInTheDocument();
    expect(screen.queryByText('binDesigner.cutouts.clearance')).not.toBeInTheDocument();
    expect(screen.queryByText('binDesigner.cutouts.sides')).not.toBeInTheDocument();
  });

  it('offers an entry chamfer for every parametric shape', () => {
    for (const shape of ['rectangle', 'circle', 'polygon', 'slot'] as const) {
      const { unmount } = renderControls(makeCutout({ shape, sides: 6 }));
      expect(screen.getByText('binDesigner.cutouts.chamfer')).toBeInTheDocument();
      unmount();
    }
  });

  it('hides the chamfer when cut depth is too shallow to bevel', () => {
    renderControls(makeCutout({ shape: 'circle', cutDepth: 0.1 }));
    expect(screen.queryByText('binDesigner.cutouts.chamfer')).not.toBeInTheDocument();
  });
});
