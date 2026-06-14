import type * as DesignSystem from '@/design-system';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PrintTab } from './PrintTab';

const mockUpdateSetting = vi.hoisted(() => vi.fn());

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('zustand/react/shallow', () => ({
  useShallow: (fn: unknown) => fn,
}));

vi.mock('@/core/store', () => ({
  useSettingsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      settings: {
        printSettings: {
          filamentCostPerKg: 20,
          layerHeightMm: 0.2,
          infillPercent: 15,
          nozzleSizeMm: 0.4,
        },
      },
      updateSetting: mockUpdateSetting,
    }),
}));

vi.mock('@/design-system', async (importActual) => {
  const actual = await importActual<typeof DesignSystem>();
  return {
    ...actual,
    Stepper: ({ 'aria-label': ariaLabel }: { 'aria-label': string }) => (
      <div data-testid={`stepper-${ariaLabel}`}>{ariaLabel}</div>
    ),
  };
});

vi.mock('@/shared/components/SettingsRow', () => ({
  SettingsRow: ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div data-testid={`settings-row-${label}`}>{children}</div>
  ),
}));

describe('PrintTab', () => {
  it('renders the print estimates heading', () => {
    render(<PrintTab />);
    expect(screen.getByText('settings.printEstimates')).toBeInTheDocument();
  });

  it('renders a stepper for cost, layer height, infill, and nozzle', () => {
    render(<PrintTab />);
    expect(screen.getByTestId('stepper-settings.filamentCostPerKg')).toBeInTheDocument();
    expect(screen.getByTestId('stepper-settings.printLayerHeight')).toBeInTheDocument();
    expect(screen.getByTestId('stepper-settings.infillPercent')).toBeInTheDocument();
    expect(screen.getByTestId('stepper-settings.nozzleSize')).toBeInTheDocument();
  });
});
