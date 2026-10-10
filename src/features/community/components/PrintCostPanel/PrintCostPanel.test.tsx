// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store/settings';
import { mm } from '@/core/types';
import type { BinParams } from '@/shared/types/bin';
import { createTestLayout, resetAllStores } from '@/test/testUtils';
import type { CommunityPrintSummary } from '@/shared/types/communityPrint';
import { PrintCostPanel } from './PrintCostPanel';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const estimate = vi.hoisted(() => vi.fn());
vi.mock('@/shared/utils/communityPrintCost', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, estimateCommunityPrint: estimate };
});

// Seeded directly rather than through setPrintBedSize, which clamps away the
// zero bed the "unknown" verdict needs.
function setLayoutBed(width: number, depth?: number): void {
  useLayoutStore.setState({
    layout: createTestLayout({
      printBedSize: mm(width),
      ...(depth === undefined ? {} : { printBedDepth: mm(depth) }),
    }),
  });
}

const PARAMS = { width: 2, depth: 3, height: 6 } as unknown as BinParams;
const METRICS = { width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 };

function summary(overrides: Partial<CommunityPrintSummary> = {}): CommunityPrintSummary {
  return {
    count: 5,
    asDesigned: 5,
    adjusted: 0,
    didNotFit: 0,
    commonMaterial: 'pla',
    commonLayerHeightMm: 0.2,
    medianPrintMinutes: 130,
    medianFilamentGrams: 24,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetAllStores();
  setLayoutBed(256, 256);
  estimate.mockReturnValue({ grams: 20, meters: 6.7, minutes: 100 });
});

describe('PrintCostPanel', () => {
  it('renders without an estimate when params are absent (assembly)', () => {
    render(<PrintCostPanel metrics={METRICS} summary={summary()} gapContext={null} />);
    expect(estimate).not.toHaveBeenCalled();
    expect(screen.getByTestId('print-cost-panel')).toBeInTheDocument();
  });

  it('labels model-derived figures as estimated', () => {
    render(<PrintCostPanel params={PARAMS} metrics={METRICS} summary={null} />);

    expect(screen.getAllByTestId('cost-source-estimated').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('cost-source-observed')).toBeNull();
    expect(screen.getByTestId('cost-estimate-note')).toBeInTheDocument();
  });

  it('labels real reports as observed and drops the estimate caveat', () => {
    render(<PrintCostPanel params={PARAMS} metrics={METRICS} summary={summary()} />);

    // An estimate must never be presented as a measurement, and vice versa.
    expect(screen.getAllByTestId('cost-source-observed').length).toBe(2);
    expect(screen.queryByTestId('cost-source-estimated')).toBeNull();
    expect(screen.queryByTestId('cost-estimate-note')).toBeNull();
  });

  it('mixes an observed time with an estimated weight', () => {
    render(
      <PrintCostPanel
        params={PARAMS}
        metrics={METRICS}
        summary={summary({ medianFilamentGrams: null })}
      />
    );

    // Reporting filament is optional, so this is the normal case.
    expect(screen.getByTestId('cost-source-observed')).toBeInTheDocument();
    expect(screen.getByTestId('cost-source-estimated')).toBeInTheDocument();
    expect(screen.getByTestId('cost-estimate-note')).toBeInTheDocument();
  });

  it('confirms a design that fits the configured bed', () => {
    render(<PrintCostPanel params={PARAMS} metrics={METRICS} summary={null} />);
    expect(screen.getByTestId('cost-bed-fits')).toBeInTheDocument();
  });

  it('warns when the design is larger than the bed, noting rotation was tried', () => {
    setLayoutBed(100, 100);
    render(<PrintCostPanel params={PARAMS} metrics={METRICS} summary={null} />);

    expect(screen.getByTestId('cost-bed-too-large')).toBeInTheDocument();
    // Answers the obvious "but what if I turn it?" before it is asked.
    expect(screen.getByText('community.cost.bedHint')).toBeInTheDocument();
  });

  it('treats a layout with no bed depth as a square bed', () => {
    setLayoutBed(100);
    render(<PrintCostPanel params={PARAMS} metrics={METRICS} summary={null} />);
    expect(screen.getByTestId('cost-bed-too-large')).toBeInTheDocument();
  });

  it("checks the layout's bed, not the default for new layouts", () => {
    useSettingsStore.getState().updateSetting('defaultPrintBedSize', 100);
    render(<PrintCostPanel params={PARAMS} metrics={METRICS} summary={null} />);
    expect(screen.getByTestId('cost-bed-fits')).toBeInTheDocument();
  });

  it('omits the rotation note when the design already fits', () => {
    render(<PrintCostPanel params={PARAMS} metrics={METRICS} summary={null} />);
    expect(screen.queryByText('community.cost.bedHint')).toBeNull();
  });

  it('omits the estimate caveat when no estimated figure is on screen', () => {
    estimate.mockImplementation(() => {
      throw new Error('unknown param shape');
    });

    render(<PrintCostPanel params={PARAMS} metrics={METRICS} summary={null} />);

    // Only bed-fit text renders here, so a note claiming a model figure
    // would be describing something that is not there.
    expect(screen.queryByTestId('cost-time')).toBeNull();
    expect(screen.queryByTestId('cost-estimate-note')).toBeNull();
  });

  it('survives params the estimator cannot read', () => {
    estimate.mockImplementation(() => {
      throw new Error('unknown param shape');
    });

    render(<PrintCostPanel params={PARAMS} metrics={METRICS} summary={null} />);

    // A design published by an older client must not take the detail down.
    expect(screen.queryByTestId('cost-time')).toBeNull();
    expect(screen.getByTestId('cost-bed-fits')).toBeInTheDocument();
  });

  it('renders nothing when it has neither a figure nor a usable bed', () => {
    estimate.mockImplementation(() => {
      throw new Error('nope');
    });
    setLayoutBed(0, 0);

    render(<PrintCostPanel params={PARAMS} metrics={METRICS} summary={null} />);

    expect(screen.queryByTestId('print-cost-panel')).toBeNull();
  });

  describe('gap fit', () => {
    const gap = {
      widthMax: 3,
      depthMax: 2,
      maxHeight: 6,
      gridUnitMm: 42,
      gridUnitMmY: 42,
      heightUnitMm: 7,
    };

    it('says nothing when the viewer is not filling a gap', () => {
      render(<PrintCostPanel params={PARAMS} metrics={METRICS} summary={null} />);
      expect(screen.queryByTestId('cost-gap-fits')).toBeNull();
    });

    it('confirms a design that fits the picked gap upright', () => {
      const upright = { width: 2 * 42 - 0.5, depth: 1 * 42 - 0.5, height: 21, gridUnitMm: 42 };
      render(<PrintCostPanel params={PARAMS} metrics={upright} summary={null} gapContext={gap} />);
      expect(screen.getByTestId('cost-gap-fits')).toBeInTheDocument();
    });

    it('says so when it only fits turned sideways', () => {
      // 2 wide x 3 deep against a 3 x 2 gap. Placement probes both
      // orientations, so this is a fit, not a failure.
      const rotated = { width: 2 * 42 - 0.5, depth: 3 * 42 - 0.5, height: 21, gridUnitMm: 42 };
      render(<PrintCostPanel params={PARAMS} metrics={rotated} summary={null} gapContext={gap} />);
      expect(screen.getByTestId('cost-gap-fits-rotated')).toBeInTheDocument();
    });

    it('warns when it is too big for the gap', () => {
      const big = { width: 9 * 42, depth: 9 * 42, height: 21, gridUnitMm: 42 };
      render(<PrintCostPanel params={PARAMS} metrics={big} summary={null} gapContext={gap} />);
      expect(screen.getByTestId('cost-gap-too-large')).toBeInTheDocument();
    });

    it('flags a grid-scale mismatch rather than comparing sizes', () => {
      const other = { ...METRICS, gridUnitMm: 30 };
      render(<PrintCostPanel params={PARAMS} metrics={other} summary={null} gapContext={gap} />);
      expect(screen.getByTestId('cost-gap-scale-mismatch')).toBeInTheDocument();
    });

    it('renders the panel for the gap verdict alone', () => {
      estimate.mockImplementation(() => {
        throw new Error('nope');
      });
      setLayoutBed(0, 0);

      const upright = { width: 2 * 42 - 0.5, depth: 1 * 42 - 0.5, height: 21, gridUnitMm: 42 };
      render(<PrintCostPanel params={PARAMS} metrics={upright} summary={null} gapContext={gap} />);

      expect(screen.getByTestId('print-cost-panel')).toBeInTheDocument();
    });
  });
});
