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
  // The control speaks configs; the harness keeps reporting them as the
  // `{ array }` patch its assertions were written against.
  const onUpdate = handlers.onUpdate ?? vi.fn();
  return render(
    <CutoutArrayControls
      box={cutout}
      array={cutout.array}
      binWidth={300}
      binDepth={300}
      onChange={(config) => onUpdate({ array: config })}
      onFlatten={handlers.onFlatten ?? vi.fn()}
    />
  );
}

describe('CutoutArrayControls', () => {
  it('offers a create button when there is no array', () => {
    const onUpdate = vi.fn();
    renderControls(makeCutout(), { onUpdate });
    fireEvent.click(screen.getByText('binDesigner.cutouts.repeat.create'));
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ array: expect.objectContaining({ mode: 'grid' }) })
    );
  });

  it('shows grid fields (cols/rows/pitch) for a grid array', () => {
    renderControls(makeCutout({ array: arrayCfg }));
    expect(screen.getByText('binDesigner.cutouts.repeat.cols')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.repeat.rows')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.repeat.pitchX')).toBeInTheDocument();
    expect(screen.queryByText('binDesigner.cutouts.repeat.radius')).not.toBeInTheDocument();
  });

  it('shows radial fields (count/radius/angle) for a radial array', () => {
    renderControls(makeCutout({ array: { ...arrayCfg, mode: 'radial' } }));
    expect(screen.getByText('binDesigner.cutouts.repeat.count')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.repeat.radius')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.repeat.startAngle')).toBeInTheDocument();
    expect(screen.queryByText('binDesigner.cutouts.repeat.cols')).not.toBeInTheDocument();
  });

  it('switching mode preserves other params (flat config)', () => {
    const onUpdate = vi.fn();
    renderControls(makeCutout({ array: arrayCfg }), { onUpdate });
    fireEvent.click(screen.getByText('binDesigner.cutouts.repeat.mode.radial'));
    expect(onUpdate).toHaveBeenCalledWith({ array: { ...arrayCfg, mode: 'radial' } });
  });

  it('flatten button invokes onFlatten', () => {
    const onFlatten = vi.fn();
    renderControls(makeCutout({ array: arrayCfg }), { onFlatten });
    fireEvent.click(screen.getByText('binDesigner.cutouts.repeat.flatten'));
    expect(onFlatten).toHaveBeenCalledOnce();
  });

  it('remove button clears the array', () => {
    const onUpdate = vi.fn();
    renderControls(makeCutout({ array: arrayCfg }), { onUpdate });
    fireEvent.click(screen.getByText('binDesigner.cutouts.repeat.remove'));
    expect(onUpdate).toHaveBeenCalledWith({ array: undefined });
  });
});

describe('CutoutArrayControls — overlap', () => {
  const WARNING = 'binDesigner.cutouts.repeat.overlapWarning';

  it('says nothing about a comfortably spaced array', () => {
    renderControls(makeCutout({ array: arrayCfg }));
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
  });

  it('warns rather than blocks when the repeats run into each other', () => {
    renderControls(makeCutout({ array: { ...arrayCfg, pitchX: 6 } }));
    expect(screen.getByText(WARNING)).toBeInTheDocument();
  });

  it('lets the pitch go below the master box', () => {
    // The floor was the master's own width; the field now bottoms out at the
    // absolute editor cap, so a deliberate overlap is reachable.
    renderControls(makeCutout({ width: 20, depth: 20, array: arrayCfg }));
    const pitch = screen.getByRole('spinbutton', { name: 'binDesigner.cutouts.repeat.pitchX' });
    expect(pitch).toHaveAttribute('aria-valuemin', '1');
  });

  it('stays quiet when a stagger already separates the rows', () => {
    // The reported nesting: a 4mm row pitch under a 10mm shape is fine once
    // the rows sit half a pitch apart in X.
    renderControls(
      makeCutout({
        array: { ...arrayCfg, mode: 'staggered', cols: 3, rows: 3, pitchX: 20, pitchY: 4 },
      })
    );
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
  });
});

describe('CutoutArrayControls — fill bin', () => {
  const FILL = 'binDesigner.cutouts.repeat.fillBin';

  it('sets rows and columns to what the bin holds at the current pitch', () => {
    const onUpdate = vi.fn();
    // 10mm master at 0,0 in a 300mm bin at a 12mm pitch: 1 + floor(290/12) = 25
    // per axis. 25 x 25 is over the 400-instance cap, which columns win — so
    // rows take the 16 that are left and every row is complete.
    renderControls(makeCutout({ array: { ...arrayCfg, cols: 3, rows: 2 } }), { onUpdate });

    fireEvent.click(screen.getByText(FILL));

    expect(onUpdate).toHaveBeenCalledWith({
      array: expect.objectContaining({ cols: 25, rows: 16, pitchX: 12, pitchY: 12 }),
    });
  });

  it('leaves the rest of the config alone, so the result stays editable', () => {
    const onUpdate = vi.fn();
    renderControls(makeCutout({ array: { ...arrayCfg, mode: 'staggered' } }), { onUpdate });

    fireEvent.click(screen.getByText(FILL));

    const patched = onUpdate.mock.calls[0][0].array;
    expect(patched.mode).toBe('staggered');
    expect(patched.pitchX).toBe(arrayCfg.pitchX);
    expect(patched.pitchY).toBe(arrayCfg.pitchY);
  });

  it('is inert once the bin is already full', () => {
    const onUpdate = vi.fn();
    renderControls(makeCutout({ array: { ...arrayCfg, cols: 25, rows: 16 } }), { onUpdate });
    expect(screen.getByText(FILL).closest('button')).toBeDisabled();
  });

  it('is not offered for a radial ring, which has no rows or columns', () => {
    renderControls(makeCutout({ array: { ...arrayCfg, mode: 'radial' } }));
    expect(screen.queryByText(FILL)).not.toBeInTheDocument();
  });
});
