// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { BinParams } from '@/shared/types/bin';
import type { CommunityPrintSummary } from '@/shared/types/communityPrint';
import { PrintCostPanel } from './PrintCostPanel';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const estimate = vi.hoisted(() => vi.fn());
vi.mock('@/shared/utils/communityPrintCost', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, estimateCommunityPrint: estimate };
});

const bed = vi.hoisted(() => ({ width: 256, depth: 256 }));
vi.mock('@/core/store/settings', () => ({
  useSettingsStore: (selector: (s: unknown) => unknown) =>
    selector({
      settings: { defaultPrintBedSize: bed.width, defaultPrintBedDepth: bed.depth },
    }),
}));

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
  bed.width = 256;
  bed.depth = 256;
  estimate.mockReturnValue({ grams: 20, meters: 6.7, minutes: 100 });
});

describe('PrintCostPanel', () => {
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
    bed.width = 100;
    bed.depth = 100;
    render(<PrintCostPanel params={PARAMS} metrics={METRICS} summary={null} />);

    expect(screen.getByTestId('cost-bed-too-large')).toBeInTheDocument();
    // Answers the obvious "but what if I turn it?" before it is asked.
    expect(screen.getByText('community.cost.bedHint')).toBeInTheDocument();
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
    bed.width = 0;
    bed.depth = 0;

    render(<PrintCostPanel params={PARAMS} metrics={METRICS} summary={null} />);

    expect(screen.queryByTestId('print-cost-panel')).toBeNull();
  });
});
