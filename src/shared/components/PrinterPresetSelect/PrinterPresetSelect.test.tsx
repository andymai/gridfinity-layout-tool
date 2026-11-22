import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PRINTER_BED_PRESETS } from '@/shared/printSettings';
import type { PrinterBedPreset } from '@/shared/printSettings';
import { PrinterPresetSelect } from './PrinterPresetSelect';

const trackEvent = vi.fn();
vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

function sizeKey(preset: PrinterBedPreset): string {
  return `${preset.widthMm}x${preset.depthMm}`;
}

function presetsBySize(): Map<string, PrinterBedPreset[]> {
  const bySize = new Map<string, PrinterBedPreset[]>();
  for (const preset of PRINTER_BED_PRESETS) {
    bySize.set(sizeKey(preset), [...(bySize.get(sizeKey(preset)) ?? []), preset]);
  }
  return bySize;
}

function requirePreset(predicate: (preset: PrinterBedPreset) => boolean): PrinterBedPreset {
  const preset = PRINTER_BED_PRESETS.find(predicate);
  if (!preset) throw new Error('preset table has no entry for this test');
  return preset;
}

const uniqueSquare = requirePreset(
  (p) => p.widthMm === p.depthMm && presetsBySize().get(sizeKey(p))?.length === 1
);
const rectangular = requirePreset((p) => p.widthMm !== p.depthMm);
const shared = requirePreset((p) => (presetsBySize().get(sizeKey(p))?.length ?? 0) > 1);

function selectEl(): HTMLSelectElement {
  return screen.getByRole<HTMLSelectElement>('combobox');
}

describe('PrinterPresetSelect', () => {
  beforeEach(() => {
    trackEvent.mockClear();
  });

  it('sends only the width for a square printer', () => {
    const onChange = vi.fn();
    render(<PrinterPresetSelect width={999} depth={999} onChange={onChange} surface="sidebar" />);
    fireEvent.change(selectEl(), { target: { value: uniqueSquare.id } });
    expect(onChange).toHaveBeenCalledWith(uniqueSquare.widthMm, undefined);
  });

  it('sends width and depth for a rectangular printer', () => {
    const onChange = vi.fn();
    render(<PrinterPresetSelect width={999} depth={999} onChange={onChange} surface="sidebar" />);
    fireEvent.change(selectEl(), { target: { value: rectangular.id } });
    expect(onChange).toHaveBeenCalledWith(rectangular.widthMm, rectangular.depthMm);
  });

  it('shows the placeholder when no printer has the bed size', () => {
    render(<PrinterPresetSelect width={999} depth={999} onChange={vi.fn()} surface="sidebar" />);
    expect(selectEl().value).toBe('');
  });

  it('names the printer when only one has the bed size', () => {
    render(
      <PrinterPresetSelect
        width={uniqueSquare.widthMm}
        depth={uniqueSquare.depthMm}
        onChange={vi.fn()}
        surface="sidebar"
      />
    );
    expect(selectEl().value).toBe(uniqueSquare.id);
  });

  it('keeps the placeholder for a shared bed size until a printer is picked', () => {
    const { rerender } = render(
      <PrinterPresetSelect
        width={shared.widthMm}
        depth={shared.depthMm}
        onChange={vi.fn()}
        surface="baseplate"
      />
    );
    expect(selectEl().value).toBe('');

    fireEvent.change(selectEl(), { target: { value: shared.id } });
    rerender(
      <PrinterPresetSelect
        width={shared.widthMm}
        depth={shared.depthMm}
        onChange={vi.fn()}
        surface="baseplate"
      />
    );
    expect(selectEl().value).toBe(shared.id);
  });

  it('drops the picked printer once the bed size no longer matches it', () => {
    const { rerender } = render(
      <PrinterPresetSelect
        width={shared.widthMm}
        depth={shared.depthMm}
        onChange={vi.fn()}
        surface="baseplate"
      />
    );
    fireEvent.change(selectEl(), { target: { value: shared.id } });
    rerender(
      <PrinterPresetSelect width={999} depth={999} onChange={vi.fn()} surface="baseplate" />
    );
    expect(selectEl().value).toBe('');
  });

  it('records which printer was picked and where', () => {
    render(<PrinterPresetSelect width={999} depth={999} onChange={vi.fn()} surface="baseplate" />);
    fireEvent.change(selectEl(), { target: { value: rectangular.id } });
    expect(trackEvent).toHaveBeenCalledWith('printer_preset_selected', {
      printer: rectangular.id,
      surface: 'baseplate',
    });
  });
});
