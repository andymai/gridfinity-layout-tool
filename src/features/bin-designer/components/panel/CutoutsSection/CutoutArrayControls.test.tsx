import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CutoutArrayControls } from './CutoutArrayControls';
import type { Cutout, CutoutArrayConfig } from '@/features/bin-designer/types';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

const arrayCfg: CutoutArrayConfig = {
  mode: 'grid',
  cols: 3,
  rows: 2,
  pitchX: 12,
  pitchY: 12,
  count: 6,
  radius: 20,
  startAngle: 0,
  rotateToCenter: true,
};

function makeCutout(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'c1',
    shape: 'circle',
    x: 0,
    y: 0,
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

/** Render with a roomy bin so feasibility clamping doesn't interfere with assertions. */
function renderControls(
  cutout: Cutout,
  handlers: { onUpdate?: (patch: Partial<Cutout>) => void; onFlatten?: () => void } = {}
) {
  return render(
    <CutoutArrayControls
      cutout={cutout}
      binWidth={300}
      binDepth={300}
      onUpdate={handlers.onUpdate ?? vi.fn()}
      onFlatten={handlers.onFlatten ?? vi.fn()}
    />
  );
}

describe('CutoutArrayControls', () => {
  it('offers a create button when there is no array', () => {
    const onUpdate = vi.fn();
    renderControls(makeCutout(), { onUpdate });
    fireEvent.click(screen.getByText('binDesigner.cutouts.array.create'));
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ array: expect.objectContaining({ mode: 'grid' }) })
    );
  });

  it('shows grid fields (cols/rows/pitch) for a grid array', () => {
    renderControls(makeCutout({ array: arrayCfg }));
    expect(screen.getByText('binDesigner.cutouts.array.cols')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.array.rows')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.array.pitchX')).toBeInTheDocument();
    expect(screen.queryByText('binDesigner.cutouts.array.radius')).not.toBeInTheDocument();
  });

  it('shows radial fields (count/radius/angle) for a radial array', () => {
    renderControls(makeCutout({ array: { ...arrayCfg, mode: 'radial' } }));
    expect(screen.getByText('binDesigner.cutouts.array.count')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.array.radius')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.array.startAngle')).toBeInTheDocument();
    expect(screen.queryByText('binDesigner.cutouts.array.cols')).not.toBeInTheDocument();
  });

  it('switching mode preserves other params (flat config)', () => {
    const onUpdate = vi.fn();
    renderControls(makeCutout({ array: arrayCfg }), { onUpdate });
    fireEvent.click(screen.getByText('binDesigner.cutouts.array.mode.radial'));
    expect(onUpdate).toHaveBeenCalledWith({ array: { ...arrayCfg, mode: 'radial' } });
  });

  it('flatten button invokes onFlatten', () => {
    const onFlatten = vi.fn();
    renderControls(makeCutout({ array: arrayCfg }), { onFlatten });
    fireEvent.click(screen.getByText('binDesigner.cutouts.array.flatten'));
    expect(onFlatten).toHaveBeenCalledOnce();
  });

  it('remove button clears the array', () => {
    const onUpdate = vi.fn();
    renderControls(makeCutout({ array: arrayCfg }), { onUpdate });
    fireEvent.click(screen.getByText('binDesigner.cutouts.array.remove'));
    expect(onUpdate).toHaveBeenCalledWith({ array: undefined });
  });
});
