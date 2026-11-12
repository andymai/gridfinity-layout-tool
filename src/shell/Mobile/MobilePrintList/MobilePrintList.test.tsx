import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MobilePrintList } from './MobilePrintList';
import { createTestBin, resetAllStores } from '@/test/testUtils';
import { useLayoutStore } from '@/core/store';
import { designId, gridUnits, mm } from '@/core/types';
import { resetCustomBinsCache } from '@/features/bin-designer/hooks/useCustomBins';
import { upsertRegistryEntry } from '@/features/bin-designer/store/customBinRegistry';
// The shell composition root feeds the registry's split switches to the layout.
import '@/shell/registrations/LinkedRiseRegistration';

vi.mock('@/features/print-export', () => ({
  PrintList: () => <div data-testid="print-list" />,
}));

describe('MobilePrintList', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    localStorage.clear();
    resetCustomBinsCache();
  });

  it('renders without crashing', () => {
    render(<MobilePrintList />);
  });

  it('marks a bin whose design prints it in one piece past the bed, with no piece count', () => {
    const id = designId('long');
    upsertRegistryEntry({
      id,
      name: 'Long',
      width: 6,
      depth: 1,
      height: 3,
      splitToFitBed: false,
      updatedAt: '2026-11-12T00:00:00.000Z',
    });
    const layout = useLayoutStore.getState().layout;
    const bin = createTestBin({
      width: gridUnits(6),
      depth: gridUnits(1),
      layerId: layout.layers[0].id,
      category: layout.categories[0].id,
      linkedDesignId: id,
    });
    useLayoutStore.setState({ layout: { ...layout, printBedSize: mm(180), bins: [bin] } });

    render(<MobilePrintList />);

    expect(screen.getByText('Exceeds print size, prints in one piece')).toBeInTheDocument();
    expect(screen.queryByText('Split')).not.toBeInTheDocument();
  });
});
