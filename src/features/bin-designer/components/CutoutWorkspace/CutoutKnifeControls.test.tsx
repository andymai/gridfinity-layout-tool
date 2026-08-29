import type * as DesignSystem from '@/design-system';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { Cutout, KnifeSpec } from '@/features/bin-designer/types';
import { knifeSlotPresetById } from '../panel/CutoutsSection/knifeSlotPresets';
import { CutoutKnifeControls } from './CutoutKnifeControls';

vi.mock('@/design-system', async () => ({
  ...(await vi.importActual<typeof DesignSystem>('@/design-system')),
  NumberField: ({
    label,
    value,
    onChange,
    disabled,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    disabled?: boolean;
  }) => (
    <input
      data-testid={`compact-input-${label}`}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  ),
}));

// Echoes the key like the shared mock, but keeps the interpolated values: the
// depth warning's whole job is to name a bin height, and a key with no
// placeholder in its own text drops them.
vi.mock('@/i18n', () => ({
  useTranslation:
    () =>
    (key: string, vars?: Record<string, string | number>): string =>
      vars ? `${key} ${Object.values(vars).join(' ')}` : key,
}));

const CUSTOM: KnifeSpec = {
  bladeLengthMm: 205,
  heelHeightMm: 47,
  spineThicknessMm: 2.3,
  handleWidthMm: 26,
  handleHeightMm: 22,
  openEnd: 'end',
};

function knifeSlot(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'k1',
    shape: 'knifeSlot',
    x: 10,
    y: 10,
    width: 200,
    depth: 4,
    cutDepth: 51,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    knife: CUSTOM,
    ...overrides,
  };
}

/** A knife block: solid interior, 8u tall (51mm of wall above the socket). */
function setParams(over: Partial<typeof DEFAULT_BIN_PARAMS> = {}): void {
  useDesignerStore.setState({
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 6,
      depth: 1,
      height: 8,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      ...over,
    },
  });
}

function renderControls(cutout: Cutout, onUpdate: (patch: Partial<Cutout>) => void) {
  return render(
    <CutoutKnifeControls
      cutout={cutout}
      binWidth={300}
      binDepth={200}
      disabled={false}
      onUpdate={onUpdate}
    />
  );
}

beforeEach(() => setParams());

describe('CutoutKnifeControls', () => {
  it('derives the slot from a picked preset and keeps the centre', () => {
    const onUpdate = vi.fn<(patch: Partial<Cutout>) => void>();
    renderControls(knifeSlot(), onUpdate);

    fireEvent.click(screen.getByText('binDesigner.cutouts.knifePreset.paring'));

    const patch = onUpdate.mock.calls[0][0];
    // Paring: 90mm blade + 10mm margin, 1.8mm spine + 1.5mm clearance,
    // 20mm heel + 4mm edge float.
    expect(patch.width).toBe(100);
    expect(patch.depth).toBe(3.3);
    expect(patch.cutDepth).toBe(24);
    expect(patch.knife).toEqual(knifeSlotPresetById('paring')?.knife);
    // Centre held: the slot shrinks in place instead of jumping to its origin.
    expect((patch.x ?? 0) + (patch.width ?? 0) / 2).toBeCloseTo(110);
    expect((patch.y ?? 0) + (patch.depth ?? 0) / 2).toBeCloseTo(12);
  });

  it('keeps a knife longer than the board at its measured length', () => {
    // The measurement survives and the slot lands off-board, where the banner
    // offers to grow the bin — truncating it would ship a slot too short for
    // the blade it was sized for.
    const onUpdate = vi.fn<(patch: Partial<Cutout>) => void>();
    render(
      <CutoutKnifeControls
        cutout={knifeSlot()}
        binWidth={100}
        binDepth={200}
        disabled={false}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByText('binDesigner.cutouts.knifePreset.chef8'));

    const patch = onUpdate.mock.calls[0][0];
    expect(patch.width).toBe(215);
    expect(patch.x).toBe(0);
  });

  it('marks the active preset chip', () => {
    renderControls(knifeSlot({ knife: { ...CUSTOM, presetId: 'santoku7' } }), vi.fn());
    expect(
      screen.getByRole('button', { name: 'binDesigner.cutouts.knifePreset.santoku7' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'binDesigner.cutouts.knifePreset.chef8' })
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('re-derives the slot and drops the preset when a measurement is edited', () => {
    const onUpdate = vi.fn<(patch: Partial<Cutout>) => void>();
    renderControls(knifeSlot({ knife: { ...CUSTOM, presetId: 'chef8' } }), onUpdate);

    fireEvent.change(screen.getByTestId('compact-input-binDesigner.cutouts.knifeBladeLength'), {
      target: { value: '150' },
    });

    const patch = onUpdate.mock.calls[0][0];
    expect(patch.width).toBe(160);
    expect(patch.knife).toEqual({ ...CUSTOM, bladeLengthMm: 150 });
    expect(patch.knife?.presetId).toBeUndefined();
  });

  it('re-derives the cut depth from the heel height', () => {
    const onUpdate = vi.fn<(patch: Partial<Cutout>) => void>();
    renderControls(knifeSlot(), onUpdate);

    fireEvent.change(screen.getByTestId('compact-input-binDesigner.cutouts.knifeHeelHeight'), {
      target: { value: '30' },
    });

    expect(onUpdate.mock.calls[0][0].cutDepth).toBe(34);
  });

  it('drops openEnd entirely for an enclosed slot', () => {
    const onUpdate = vi.fn<(patch: Partial<Cutout>) => void>();
    renderControls(knifeSlot(), onUpdate);

    fireEvent.click(screen.getByText('binDesigner.cutouts.knifeOpenEnd.enclosed'));

    expect(onUpdate).toHaveBeenCalledWith({
      knife: {
        bladeLengthMm: 205,
        heelHeightMm: 47,
        spineThicknessMm: 2.3,
        handleWidthMm: 26,
        handleHeightMm: 22,
      },
    });
  });

  it('aims the blade vertically without touching its size', () => {
    const onUpdate = vi.fn<(patch: Partial<Cutout>) => void>();
    renderControls(knifeSlot(), onUpdate);

    fireEvent.click(screen.getByText('binDesigner.cutouts.knifeOrientation.vertical'));

    expect(onUpdate).toHaveBeenCalledWith({ rotation: 90 });
  });

  it('re-derives the slot and drops the preset when the handle width is edited', () => {
    const onUpdate = vi.fn<(patch: Partial<Cutout>) => void>();
    renderControls(knifeSlot({ knife: { ...CUSTOM, presetId: 'chef8' } }), onUpdate);

    fireEvent.change(screen.getByTestId('compact-input-binDesigner.cutouts.knifeHandleWidth'), {
      target: { value: '34' },
    });

    const patch = onUpdate.mock.calls[0][0];
    expect(patch.knife).toEqual({ ...CUSTOM, handleWidthMm: 34 });
    expect(patch.knife?.presetId).toBeUndefined();
    // The handle does not size the slot, so the blade-derived width is unchanged.
    expect(patch.width).toBe(215);
  });

  it('switches the exit end without touching the measurements', () => {
    const onUpdate = vi.fn<(patch: Partial<Cutout>) => void>();
    renderControls(knifeSlot(), onUpdate);

    fireEvent.click(screen.getByText('binDesigner.cutouts.knifeOpenEnd.start'));

    expect(onUpdate).toHaveBeenCalledWith({ knife: { ...CUSTOM, openEnd: 'start' } });
  });

  it('warns when the blade is deeper than the bin can cut, naming the height that fits', () => {
    renderControls(knifeSlot({ cutDepth: 55 }), vi.fn());
    // 55mm of blade + the 5mm socket needs 60mm of part: 9 height units.
    expect(screen.getByText(/binDesigner.cutouts.knifeDepthClamped/)).toHaveTextContent('9');
  });

  it('stays quiet while the slot fits', () => {
    renderControls(knifeSlot({ cutDepth: 51 }), vi.fn());
    expect(screen.queryByText(/binDesigner.cutouts.knifeDepthClamped/)).not.toBeInTheDocument();
  });

  it('stays quiet on a through-cut host, which has no depth to run out of', () => {
    render(
      <CutoutKnifeControls
        cutout={knifeSlot({ cutDepth: 55 })}
        binWidth={300}
        binDepth={200}
        throughOnly
        disabled={false}
        onUpdate={vi.fn()}
      />
    );
    expect(screen.queryByText(/binDesigner.cutouts.knifeDepthClamped/)).not.toBeInTheDocument();
  });
});
