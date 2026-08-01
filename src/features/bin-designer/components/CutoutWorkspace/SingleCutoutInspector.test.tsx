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

  // An oversize cutout (#3061) puts every transform field past its ceiling: W/H
  // hold a measurement the board can't contain, and X/Y have no valid offset
  // left at all, so their max collapses to 0 while the stored offset stands.
  // Every slider must still announce a range that contains its own value.
  // (That `softMax` is wired is covered by the commit test below, not here —
  // these values come from the cutout, not from the field.)
  it('announces a valid slider range for a cutout larger than the board', () => {
    renderit(makeCutout({ shape: 'rectangle', x: 20, y: 20, width: 156, depth: 156 }));
    for (const [label, now] of [
      ['W', '156'],
      ['H', '156'],
      ['X', '20'],
      ['Y', '20'],
    ] as const) {
      const slider = screen.getByRole('slider', { name: label });
      expect(slider).toHaveAttribute('aria-valuenow', now);
      expect(slider).toHaveAttribute('aria-valuemax', now);
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
