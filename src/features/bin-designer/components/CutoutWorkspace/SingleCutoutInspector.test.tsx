import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  // #3061: W/H hold a measurement, so the field must not rewrite it to the board
  // size. X/Y still clamp, but their ceiling can't go negative once W > board.
  it('marks W/H as soft-capped and keeps the X/Y ceilings non-negative', () => {
    renderit(makeCutout({ shape: 'rectangle', width: 156, depth: 156 }));
    for (const label of ['W', 'H']) {
      expect(screen.getByRole('slider', { name: label })).not.toHaveAttribute('aria-valuemax', '0');
    }
    for (const label of ['X', 'Y']) {
      expect(screen.getByRole('slider', { name: label })).toHaveAttribute('aria-valuemax', '0');
    }
  });

  it('commits a typed W past the board instead of truncating it', () => {
    const onUpdate = vi.fn();
    render(
      <SingleCutoutInspector
        cutout={makeCutout({ shape: 'rectangle' })}
        preview={new Map()}
        binWidth={123.1}
        binDepth={123.1}
        maxCutDepth={20}
        onUpdate={onUpdate}
        disabled={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'W: 10 mm' }));
    const input = screen.getByRole('textbox', { name: 'W' });
    fireEvent.change(input, { target: { value: '156' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onUpdate).toHaveBeenCalledWith('c1', { width: 156 });
  });

  it('shows the Array section for an arrayable shape but not for a path', () => {
    renderit(makeCutout({ shape: 'circle' }));
    expect(screen.getByText('binDesigner.cutouts.section.array')).toBeInTheDocument();
    renderit(makeCutout({ shape: 'path' }));
    // path: still only one array header in the document (from the circle render)
    expect(screen.getAllByText('binDesigner.cutouts.section.array')).toHaveLength(1);
  });
});
