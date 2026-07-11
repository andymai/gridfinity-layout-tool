import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SlicerHandoffPreview } from './SlicerHandoffPreview';
import { makeUniformLipCells } from '@/features/bin-designer/types/featureColors';
import type { ColorZone, FeatureColorConfig } from '@/features/bin-designer/types/featureColors';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, vars?: Record<string, string | number>) => {
    if (vars && Object.keys(vars).length > 0) {
      return `${key}:${Object.entries(vars)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(',')}`;
    }
    return key;
  },
}));

const LABELS: Partial<Record<ColorZone, string>> = {
  body: 'Body',
  labelTab: 'Label',
  base: 'Base',
  scoop: 'Scoop',
  dividers: 'Dividers',
  text: 'Text',
};
const zoneLabel = (z: ColorZone): string => LABELS[z] ?? z;

function buildColors(overrides: Partial<FeatureColorConfig> = {}): FeatureColorConfig {
  return {
    enabled: true,
    body: '#ffffff',
    lip: { corners: 1, bands: 1, cells: makeUniformLipCells('#ffffff') },
    labelTab: '#ffffff',
    base: '#ffffff',
    scoop: '#ffffff',
    dividers: '#ffffff',
    text: '#ffffff',
    lid: '#ffffff',
    topAccent: { enabled: false, heightMm: 2, color: '#ffffff' },
    ...overrides,
  };
}

describe('SlicerHandoffPreview', () => {
  it('renders nothing when the design is effectively single-color', () => {
    const { container } = render(
      <SlicerHandoffPreview
        featureColors={buildColors()}
        activeZones={new Set(['body', 'base'])}
        zoneLabel={zoneLabel}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('groups zones with the same hex into one filament', () => {
    // body + labelTab share #fff (one filament); base differs (second).
    render(
      <SlicerHandoffPreview
        featureColors={buildColors({ base: '#0000ff' })}
        activeZones={new Set<ColorZone>(['body', 'labelTab', 'base'])}
        zoneLabel={zoneLabel}
      />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/filament:n=1/)).toBeInTheDocument();
    expect(screen.getByText(/filament:n=2/)).toBeInTheDocument();
    // First filament's zone list should mention both Body and Label.
    expect(screen.getByText(/Body, Label/)).toBeInTheDocument();
  });

  it('includes the text zone when it diverges from body', () => {
    // Regression guard: the manually-curated `ordered` list previously
    // omitted 'text', so a body+text design rendered as single-filament
    // and the preview was hidden — even though the 3MF export shipped
    // two materials. Walking ZONE_ORDER keeps the preview in lockstep
    // with the exporter's `resolveColorMapping`.
    render(
      <SlicerHandoffPreview
        featureColors={buildColors({ text: '#ff0000' })}
        activeZones={new Set<ColorZone>(['body', 'text'])}
        zoneLabel={zoneLabel}
      />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/filament:n=1/)).toBeInTheDocument();
    expect(screen.getByText(/filament:n=2/)).toBeInTheDocument();
    expect(screen.getByText(/^Text$/)).toBeInTheDocument();
  });
});
