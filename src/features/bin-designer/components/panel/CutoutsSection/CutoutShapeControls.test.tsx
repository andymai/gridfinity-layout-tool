import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CutoutShapeControls } from './CutoutShapeControls';
import { hasShapeControls } from './cutoutSectionVisibility';
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

describe('hasShapeControls', () => {
  it('is true only for polygon and circle', () => {
    expect(hasShapeControls('polygon')).toBe(true);
    expect(hasShapeControls('circle')).toBe(true);
    expect(hasShapeControls('rectangle')).toBe(false);
    expect(hasShapeControls('slot')).toBe(false);
    expect(hasShapeControls('path')).toBe(false);
  });
});

describe('CutoutShapeControls', () => {
  it('shows sides, across-flats and a preset menu for a polygon', () => {
    renderControls(makeCutout({ shape: 'polygon', sides: 6 }));
    expect(screen.getByText('binDesigner.cutouts.sides')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.acrossFlats')).toBeInTheDocument();
    expect(screen.getByLabelText('binDesigner.cutouts.sizePreset')).toBeInTheDocument();
  });

  it('shows only a preset menu for a circle (no sides)', () => {
    renderControls(makeCutout({ shape: 'circle' }));
    expect(screen.getByLabelText('binDesigner.cutouts.sizePreset')).toBeInTheDocument();
    expect(screen.queryByText('binDesigner.cutouts.sides')).not.toBeInTheDocument();
  });

  it('renders nothing for rectangle and slot (no parametric sizing)', () => {
    const { container: rect } = renderControls(makeCutout({ shape: 'rectangle' }));
    expect(rect).toBeEmptyDOMElement();
    const { container: slot } = renderControls(makeCutout({ shape: 'slot', width: 30, depth: 12 }));
    expect(slot).toBeEmptyDOMElement();
  });
});
