import { useState } from 'react';
import { Select } from '@/design-system';
import type { SelectOption } from '@/design-system';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import { PRINTER_BED_PRESETS, findPrinterBedPreset } from '@/shared/printSettings';

export type PrinterPresetSurface = 'baseplate' | 'sidebar' | 'defaults' | 'mobile';

export interface PrinterPresetSelectProps {
  /** Print bed width in mm */
  width: number;
  /** Effective print bed depth in mm (pass the stored depth ?? width) */
  depth: number;
  /** Same contract as PrintBedInput: depth is undefined for a square bed */
  onChange: (width: number, depth?: number) => void;
  id?: string;
  variant?: 'compact' | 'mobile';
  /** Where the picker sits, recorded with the selection event. */
  surface: PrinterPresetSurface;
}

const OPTIONS: SelectOption[] = PRINTER_BED_PRESETS.map((preset) => ({
  id: preset.id,
  name: preset.model,
  group: preset.brand,
}));

export function PrinterPresetSelect({
  width,
  depth,
  onChange,
  id,
  variant = 'compact',
  surface,
}: PrinterPresetSelectProps) {
  const t = useTranslation();
  const [pickedId, setPickedId] = useState<string | null>(null);

  // Several printers share a bed size (256 × 256 is most of Bambu Lab's line),
  // so a size alone names a printer only when exactly one preset has it.
  const matches = PRINTER_BED_PRESETS.filter(
    (preset) => preset.widthMm === width && preset.depthMm === depth
  );
  const picked = matches.find((preset) => preset.id === pickedId);
  const value = picked?.id ?? (matches.length === 1 ? (matches[0]?.id ?? '') : '');

  const handlePick = (presetId: string) => {
    const preset = findPrinterBedPreset(presetId);
    if (!preset) return;
    setPickedId(preset.id);
    onChange(preset.widthMm, preset.depthMm === preset.widthMm ? undefined : preset.depthMm);
    trackEvent('printer_preset_selected', { printer: preset.id, surface });
  };

  return (
    <Select
      id={id}
      value={value}
      onValueChange={handlePick}
      options={OPTIONS}
      placeholder={t('printBedInput.printerPlaceholder')}
      size={variant === 'compact' ? 'sm' : 'md'}
      className={variant === 'compact' ? 'text-xs' : undefined}
    />
  );
}
