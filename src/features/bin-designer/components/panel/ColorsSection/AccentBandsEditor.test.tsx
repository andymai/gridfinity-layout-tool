import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AccentBandsEditor } from './AccentBandsEditor';
import type { AccentBandConfig } from '@/features/bin-designer/types/featureColors';

const BODY = '#d4d8dc';
const OFF: AccentBandConfig = { enabled: false, heightMm: 2, color: BODY };
const ON: AccentBandConfig = { enabled: true, heightMm: 2, color: '#ff0000' };

function setup(overrides: Partial<React.ComponentProps<typeof AccentBandsEditor>> = {}) {
  const onChangeTop = vi.fn();
  const onChangeBottom = vi.fn();
  const onUnitChange = vi.fn();
  render(
    <AccentBandsEditor
      top={OFF}
      bottom={undefined}
      defaultBand={{ enabled: true, heightMm: 2, color: BODY }}
      maxMm={21}
      unit="mm"
      layerHeightMm={0.2}
      recentColors={[]}
      swapActive={false}
      otherColorsFor={() => []}
      bodyColor={BODY}
      onUnitChange={onUnitChange}
      onChangeTop={onChangeTop}
      onChangeBottom={onChangeBottom}
      onHover={vi.fn()}
      onGestureStart={vi.fn()}
      onGestureEnd={vi.fn()}
      onSwap={vi.fn()}
      onRememberColor={vi.fn()}
      {...overrides}
    />
  );
  return { onChangeTop, onChangeBottom, onUnitChange };
}

/** The height slider for the named band's expanded block. */
function heightSliderFor(bandLabel: string): HTMLElement {
  const header = screen.getByRole('checkbox', { name: bandLabel });
  const block = header.parentElement;
  if (!block) throw new Error(`no block for ${bandLabel}`);
  return within(block).getByRole('slider');
}

describe('AccentBandsEditor', () => {
  it('offers both bands under one header', () => {
    setup();
    expect(screen.getByText('Accent bands')).toBeDefined();
    expect(screen.getByRole('checkbox', { name: 'Top accent' })).toBeDefined();
    expect(screen.getByRole('checkbox', { name: 'Bottom accent' })).toBeDefined();
  });

  // Absent means "no band", so the row must read as off rather than crash or
  // render a half-built config.
  it('shows an absent bottom band as disabled, and enables it on click', () => {
    const { onChangeBottom } = setup();
    const toggle = screen.getByRole('checkbox', { name: 'Bottom accent' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(onChangeBottom).toHaveBeenCalledWith({ enabled: true });
  });

  it('hides the height slider until a band is enabled', () => {
    setup();
    expect(screen.queryAllByRole('slider')).toHaveLength(0);
    setup({ top: ON });
    expect(screen.getAllByRole('slider').length).toBeGreaterThan(0);
  });

  it('keeps the unit toggle out of the way until a band exists', () => {
    setup();
    expect(screen.queryByRole('radiogroup', { name: 'Band height unit' })).toBeNull();
    setup({ top: ON });
    expect(screen.getByRole('radiogroup', { name: 'Band height unit' })).toBeDefined();
  });

  // The design stores absolute mm; the layer count is an entry unit only.
  it('stores mm when the slider is dragged in layers mode', () => {
    const { onChangeBottom } = setup({ bottom: ON, unit: 'layers' });
    fireEvent.change(heightSliderFor('Bottom accent'), { target: { value: '12' } });
    expect(onChangeBottom).toHaveBeenCalledWith({ heightMm: 2.4 });
  });

  it('stores mm unchanged in mm mode', () => {
    const { onChangeTop } = setup({ top: ON });
    fireEvent.change(heightSliderFor('Top accent'), { target: { value: '3.4' } });
    expect(onChangeTop).toHaveBeenCalledWith({ heightMm: 3.4 });
  });

  it('shows the layer equivalent in mm mode and the mm equivalent in layers mode', () => {
    setup({ top: ON });
    expect(screen.getByText('≈ 10 layers at 0.2mm')).toBeDefined();
    setup({ top: ON, unit: 'layers' });
    expect(screen.getByText('2mm at 0.2mm layers')).toBeDefined();
  });

  // A height authored in mm is not a layer multiple when viewed in layers, so
  // the badge and the readout have to be derived from the same number or they
  // print two values that disagree.
  it('keeps the layers badge and the mm readout in agreement', () => {
    setup({ top: { ...ON, heightMm: 2.35 }, unit: 'layers' });
    expect(heightSliderFor('Top accent').getAttribute('value')).toBe('12');
    expect(screen.getByText('2.4mm at 0.2mm layers')).toBeDefined();
  });

  it('reports a unit change without touching the design', () => {
    const { onUnitChange, onChangeTop } = setup({ top: ON });
    fireEvent.click(screen.getByRole('radio', { name: 'layers' }));
    expect(onUnitChange).toHaveBeenCalledWith('layers');
    expect(onChangeTop).not.toHaveBeenCalled();
  });
});
