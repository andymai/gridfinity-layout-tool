import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SingleCutoutInspector } from './SingleCutoutInspector';
import type { Cutout } from '@/features/bin-designer/types';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

function makeCutout(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'c1',
    shape: 'circle',
    x: 5,
    y: 5,
    width: 10,
    depth: 10,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

function renderit(cutout: Cutout) {
  return render(
    <SingleCutoutInspector
      cutout={cutout}
      preview={new Map()}
      binWidth={100}
      binDepth={100}
      maxCutDepth={20}
      onUpdate={vi.fn()}
      disabled={false}
    />
  );
}

describe('SingleCutoutInspector', () => {
  it('renders the core property sections', () => {
    renderit(makeCutout());
    expect(screen.getByText('binDesigner.cutouts.section.transform')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.section.shape')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.section.label')).toBeInTheDocument();
  });

  it('shows the Array section for an arrayable shape but not for a path', () => {
    renderit(makeCutout({ shape: 'circle' }));
    expect(screen.getByText('binDesigner.cutouts.section.array')).toBeInTheDocument();
    renderit(makeCutout({ shape: 'path' }));
    // path: still only one array header in the document (from the circle render)
    expect(screen.getAllByText('binDesigner.cutouts.section.array')).toHaveLength(1);
  });
});
