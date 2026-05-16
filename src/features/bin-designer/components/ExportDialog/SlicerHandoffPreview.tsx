/**
 * Filament-mapping preview shown in the export dialog when the design
 * is multi-color and the format is 3MF. Mirrors what slicers see in
 * the 3MF basematerials section so users can plan their AMS/MMU slots
 * before opening the slicer.
 */

import { useId, useState } from 'react';
import { ChevronDownIcon } from '@/design-system/Icon';
import {
  LIP_CORNERS,
  getZoneColor,
  lipCornerZone,
} from '@/features/bin-designer/types/featureColors';
import type { ColorZone, FeatureColorConfig } from '@/features/bin-designer/types/featureColors';
import { useTranslation } from '@/i18n';

interface SlicerHandoffPreviewProps {
  featureColors: FeatureColorConfig;
  activeZones: ReadonlySet<ColorZone>;
  zoneLabels: Record<ColorZone, string>;
}

interface Filament {
  color: string;
  zones: string[];
}

function buildFilaments(
  featureColors: FeatureColorConfig,
  activeZones: ReadonlySet<ColorZone>,
  labels: Record<ColorZone, string>
): Filament[] {
  // Body always lands first so its filament index is 0 — mirrors the
  // 3MF exporter's `resolveColorMapping` ordering.
  const ordered: ColorZone[] = [
    'body',
    ...LIP_CORNERS.map(lipCornerZone),
    'labelTab',
    'base',
    'scoop',
    'dividers',
  ];

  const byHex = new Map<string, Filament>();
  for (const z of ordered) {
    if (!activeZones.has(z)) continue;
    const hex = getZoneColor(featureColors, z).toLowerCase();
    const existing = byHex.get(hex);
    if (existing) {
      existing.zones.push(labels[z]);
    } else {
      byHex.set(hex, { color: hex, zones: [labels[z]] });
    }
  }
  return [...byHex.values()];
}

export function SlicerHandoffPreview({
  featureColors,
  activeZones,
  zoneLabels,
}: SlicerHandoffPreviewProps) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const filaments = buildFilaments(featureColors, activeZones, zoneLabels);

  if (filaments.length < 2) return null;

  return (
    <div className="mb-4 rounded-lg border border-stroke-subtle bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-content-secondary hover:bg-surface-hover rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="flex items-center gap-2">
          <span className="flex gap-0.5" aria-hidden="true">
            {filaments.slice(0, 5).map((f, i) => (
              <span
                key={i}
                className="block h-3 w-3 rounded-sm border border-stroke-subtle/60"
                style={{ backgroundColor: f.color }}
              />
            ))}
          </span>
          <span>{t('binDesigner.colors.slicerHandoff.show')}</span>
        </span>
        <ChevronDownIcon
          size="sm"
          className={`text-content-tertiary transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </button>

      {open && (
        <div id={panelId} className="border-t border-stroke-subtle/60 px-3 py-2.5 space-y-2">
          <p className="text-xs font-medium text-content">
            {t('binDesigner.colors.slicerHandoff.title')}
          </p>
          <p className="text-[11px] text-content-tertiary">
            {t('binDesigner.colors.slicerHandoff.description')}
          </p>
          <ul className="space-y-1.5">
            {filaments.map((f, i) => (
              <li key={f.color} className="flex items-center gap-2 text-xs">
                <span
                  className="h-5 w-5 shrink-0 rounded-md border border-stroke-subtle/60 shadow-inner"
                  style={{ backgroundColor: f.color }}
                />
                <span className="font-medium text-content">
                  {t('binDesigner.colors.slicerHandoff.filament', { n: i + 1 })}
                </span>
                <span className="font-mono text-[11px] text-content-secondary tabular-nums">
                  {f.color}
                </span>
                <span className="ml-auto truncate text-[11px] text-content-tertiary">
                  {
                    // eslint-disable-next-line i18next/no-literal-string -- joiner is punctuation, not user copy
                    f.zones.join(', ')
                  }
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
