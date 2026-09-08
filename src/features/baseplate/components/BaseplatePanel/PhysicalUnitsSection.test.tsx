import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PhysicalUnitsSection } from './PhysicalUnitsSection';
import { useSettingsStore } from '@/core/store/settings';
import { useLayoutStore } from '@/core/store/layout';
import { mm } from '@/core/types';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

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

  // The whole point of #4142: a square grid gave no hint that Y was separately
  // settable, so the unlink control has to be reachable before X !== Y.
  it('offers the unlink control on a square grid', () => {
    render(<PhysicalUnitsSection />);
    expect(
      screen.getByRole('button', { name: 'gridUnitInput.unlinkAriaLabel' })
    ).toBeInTheDocument();
  });

  it('unlinking lets an independent Y pitch be committed to the layout', () => {
    render(<PhysicalUnitsSection />);
    fireEvent.click(screen.getByRole('button', { name: 'gridUnitInput.unlinkAriaLabel' }));

    const x = screen.getByLabelText('gridUnitInput.xAriaLabel');
    fireEvent.change(x, { target: { value: '40' } });
    fireEvent.blur(x);

    expect(useLayoutStore.getState().layout.gridUnitMm).toBe(40);
    expect(useLayoutStore.getState().layout.gridUnitMmY).toBe(42);
  });

  it('widens the collapsed summary to X\u00d7Y on a non-square grid', () => {
    useLayoutStore.setState({
      layout: { ...useLayoutStore.getState().layout, gridUnitMm: mm(40), gridUnitMmY: mm(42) },
    });
    render(<PhysicalUnitsSection />);
    expect(screen.getByText(/40\u00d742mm/)).toBeInTheDocument();
  });

  it('shows both pitches when the layout already has a non-square grid', () => {
    useLayoutStore.setState({
      layout: { ...useLayoutStore.getState().layout, gridUnitMmY: mm(30) },
    });
    render(<PhysicalUnitsSection />);
    expect(screen.getByLabelText('gridUnitInput.yAriaLabel')).toHaveValue(30);
  });
});
