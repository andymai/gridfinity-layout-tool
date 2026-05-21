import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SlicerHandoffPreview } from './SlicerHandoffPreview';
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

const zoneLabels: Record<ColorZone, string> = {
  body: 'Body',
  'lip:frontLeft': 'Lip · FL',
  'lip:frontRight': 'Lip · FR',
  'lip:backRight': 'Lip · BR',
  'lip:backLeft': 'Lip · BL',
  labelTab: 'Label',
  base: 'Base',
  scoop: 'Scoop',
  dividers: 'Dividers',
};

function buildColors(overrides: Partial<FeatureColorConfig> = {}): FeatureColorConfig {
  return {
    enabled: true,
    body: '#ffffff',
    lip: { frontLeft: '#ffffff', frontRight: '#ffffff', backRight: '#ffffff', backLeft: '#ffffff' },
    labelTab: '#ffffff',
    base: '#ffffff',
    scoop: '#ffffff',
    dividers: '#ffffff',
    text: '#ffffff',
    ...overrides,
  };
}

describe('SlicerHandoffPreview', () => {
  it('renders nothing when the design is effectively single-color', () => {
    const { container } = render(
      <SlicerHandoffPreview
        featureColors={buildColors()}
        activeZones={new Set(['body', 'base'])}
        zoneLabels={zoneLabels}
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
        zoneLabels={zoneLabels}
      />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/filament:n=1/)).toBeInTheDocument();
    expect(screen.getByText(/filament:n=2/)).toBeInTheDocument();
    // First filament's zone list should mention both Body and Label.
    expect(screen.getByText(/Body, Label/)).toBeInTheDocument();
  });
});
