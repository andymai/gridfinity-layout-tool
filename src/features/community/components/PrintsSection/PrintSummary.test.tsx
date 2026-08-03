// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CommunityPrintSummary } from '@/shared/types/communityPrint';
import { PrintSummary } from './PrintSummary';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

function summary(overrides: Partial<CommunityPrintSummary> = {}): CommunityPrintSummary {
  return {
    count: 4,
    asDesigned: 3,
    adjusted: 1,
    didNotFit: 0,
    commonMaterial: 'pla',
    commonLayerHeightMm: 0.2,
    medianPrintMinutes: 127,
    medianFilamentGrams: 18.4,
    ...overrides,
  };
}

describe('PrintSummary', () => {
  it('renders nothing when nobody has printed it', () => {
    render(<PrintSummary summary={summary({ count: 0 })} />);
    expect(screen.queryByTestId('print-summary')).toBeNull();
  });

  it('uses the singular count for one printer', () => {
    render(<PrintSummary summary={summary({ count: 1 })} />);
    expect(screen.getByText('community.prints.countOne')).toBeInTheDocument();
  });

  it('lists only the verdicts that actually occurred', () => {
    render(<PrintSummary summary={summary({ asDesigned: 3, adjusted: 1, didNotFit: 0 })} />);
    const verdicts = screen.getByTestId('print-summary-verdicts');
    expect(verdicts).toHaveTextContent('community.prints.verdictAsDesigned');
    expect(verdicts).toHaveTextContent('community.prints.verdictAdjusted');
    // A zero count is absent, not rendered as "0 did not fit".
    expect(verdicts).not.toHaveTextContent('community.prints.verdictDidNotFit');
  });

  it('surfaces a did-not-fit tally when there is one', () => {
    render(<PrintSummary summary={summary({ didNotFit: 2 })} />);
    expect(screen.getByTestId('print-summary-verdicts')).toHaveTextContent(
      'community.prints.verdictDidNotFit'
    );
  });

  it('omits figures nobody reported rather than showing zero', () => {
    render(
      <PrintSummary
        summary={summary({
          commonMaterial: null,
          commonLayerHeightMm: null,
          medianPrintMinutes: null,
          medianFilamentGrams: null,
        })}
      />
    );
    // An absent number must never read as a measured one.
    expect(screen.queryByTestId('print-summary-facts')).toBeNull();
  });

  it('includes filament only when someone reported it', () => {
    render(<PrintSummary summary={summary({ medianFilamentGrams: null })} />);
    const facts = screen.getByTestId('print-summary-facts');
    expect(facts).not.toHaveTextContent('community.prints.summaryFilament');
    expect(facts).toHaveTextContent('community.prints.summaryTime');
  });
});
