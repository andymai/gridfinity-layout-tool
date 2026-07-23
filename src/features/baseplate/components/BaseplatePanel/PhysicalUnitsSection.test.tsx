import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PhysicalUnitsSection } from './PhysicalUnitsSection';
import { useSettingsStore } from '@/core/store/settings';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return Object.entries(params).reduce((str, [k, v]) => str.replace(`{${k}}`, String(v)), key);
    }
    return key;
  },
}));

describe('PhysicalUnitsSection', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('renders grid unit, print bed, nozzle, and max height inputs', () => {
    render(<PhysicalUnitsSection />);
    expect(screen.getByLabelText('settings.nozzleSize')).toBeInTheDocument();
    expect(screen.getByLabelText('baseplate.maxPrintHeight')).toBeInTheDocument();
    expect(screen.getByText('baseplate.gridUnit')).toBeInTheDocument();
    expect(screen.getByText('baseplate.printBedSize')).toBeInTheDocument();
  });

  it('committing a nozzle size writes through to the settings store', () => {
    render(<PhysicalUnitsSection />);
    const input = screen.getByLabelText('settings.nozzleSize');
    fireEvent.change(input, { target: { value: '0.6' } });
    fireEvent.blur(input);
    expect(useSettingsStore.getState().settings.printSettings.nozzleSizeMm).toBe(0.6);
  });

  it('hides the magnet anchor control at the standard 42mm grid', () => {
    render(<PhysicalUnitsSection />);
    expect(screen.queryByText('baseplate.magnetAnchor')).not.toBeInTheDocument();
  });
});
