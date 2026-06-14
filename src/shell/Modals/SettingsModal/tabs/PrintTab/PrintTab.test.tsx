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

vi.mock('@/shared/components/DeferredNumberInput', () => ({
  DeferredNumberInput: ({ id }: { id: string }) => <input data-testid={`input-${id}`} />,
}));

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

  it('renders inputs for cost, layer height, infill, and nozzle', () => {
    render(<PrintTab />);
    expect(screen.getByTestId('input-filamentCostPerKg')).toBeInTheDocument();
    expect(screen.getByTestId('input-printLayerHeight')).toBeInTheDocument();
    expect(screen.getByTestId('input-infillPercent')).toBeInTheDocument();
    expect(screen.getByTestId('input-nozzleSize')).toBeInTheDocument();
  });
});
