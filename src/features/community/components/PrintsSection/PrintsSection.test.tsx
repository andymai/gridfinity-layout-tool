// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { err, ok } from '@/core/result';
import type { CommunityPrint } from '@/shared/types/communityPrint';
import { PrintsSection } from './PrintsSection';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const api = vi.hoisted(() => ({ fetchPrints: vi.fn() }));
vi.mock('../../api/printsClient', () => api);

function print(id: string, overrides: Partial<CommunityPrint> = {}): CommunityPrint {
  return {
    id,
    designId: 'abc123def456',
    authorPublicId: id.padEnd(32, 'x').slice(0, 32),
    authorName: 'Casey',
    photos: [],
    settings: {
      material: 'pla',
      nozzleMm: 0.4,
      layerHeightMm: 0.2,
      printMinutes: 120,
      printer: 'bambu-p1s',
    },
    fitVerdict: 'as-designed',
    note: '',
    createdAt: 1,
    updatedAt: 1,
    status: 'live',
    ...overrides,
  };
}

const SUMMARY = {
  count: 1,
  asDesigned: 1,
  adjusted: 0,
  didNotFit: 0,
  commonMaterial: 'pla' as const,
  commonLayerHeightMm: 0.2,
  medianPrintMinutes: 120,
  medianFilamentGrams: null,
};

function page(items: CommunityPrint[], nextCursor: string | null = null, summary = SUMMARY) {
  return ok({ items, nextCursor, summary, mine: null });
}

function setup(props: Partial<React.ComponentProps<typeof PrintsSection>> = {}) {
  return render(
    <PrintsSection designId="abc123def456" ownPrint={null} refreshToken={0} {...props} />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchPrints.mockResolvedValue(page([print('a')]));
});

describe('PrintsSection', () => {
  it('shows a spinner until the first page resolves', () => {
    setup();
    expect(screen.getByTestId('prints-section-loading')).toBeInTheDocument();
  });

  it('renders the summary and the list', async () => {
    setup();
    await waitFor(() => expect(screen.getByTestId('prints-section')).toBeInTheDocument());
    expect(screen.getByTestId('print-summary')).toBeInTheDocument();
    expect(screen.getByTestId(`print-card-${'a'.padEnd(32, 'x')}`)).toBeInTheDocument();
  });

  it('invites the viewer to be first when there are no prints', async () => {
    api.fetchPrints.mockResolvedValue(page([], null, { ...SUMMARY, count: 0 }));
    setup();
    await waitFor(() => expect(screen.getByTestId('prints-section-empty')).toBeInTheDocument());
    expect(screen.getByTestId('prints-section-empty')).toHaveTextContent(
      'community.prints.emptyOwn'
    );
  });

  it('renders an empty section rather than an error when the feature is off', async () => {
    api.fetchPrints.mockResolvedValue(err({ kind: 'disabled' }));
    setup();
    // "We could not load this" is wrong when the feature is simply switched off.
    await waitFor(() => expect(screen.getByTestId('prints-section')).toBeInTheDocument());
    expect(screen.queryByTestId('prints-section-error')).toBeNull();
  });

  it('offers a retry after a real failure', async () => {
    api.fetchPrints.mockResolvedValue(err({ kind: 'server' }));
    setup();
    await waitFor(() => expect(screen.getByTestId('prints-section-error')).toBeInTheDocument());

    api.fetchPrints.mockResolvedValue(page([print('a')]));
    fireEvent.click(screen.getByText('community.prints.retry'));
    await waitFor(() => expect(screen.getByTestId('prints-section')).toBeInTheDocument());
  });

  it("marks the viewer's own print", async () => {
    setup({ ownPrint: print('a') });
    await waitFor(() => expect(screen.getByText('community.prints.yours')).toBeInTheDocument());
  });

  it('paginates and drops records that arrive on both pages', async () => {
    api.fetchPrints.mockResolvedValueOnce(page([print('a')], '24'));
    setup();
    await waitFor(() => expect(screen.getByTestId('prints-load-more')).toBeInTheDocument());

    // A write landing mid-pagination shifts the offsets, so page two can
    // repeat a record page one already showed.
    api.fetchPrints.mockResolvedValueOnce(page([print('a'), print('b')], null));
    fireEvent.click(screen.getByTestId('prints-load-more'));

    await waitFor(() =>
      expect(screen.getByTestId(`print-card-${'b'.padEnd(32, 'x')}`)).toBeInTheDocument()
    );
    expect(screen.getAllByTestId(`print-card-${'a'.padEnd(32, 'x')}`)).toHaveLength(1);
  });

  it('hides load more once the cursor is exhausted', async () => {
    setup();
    await waitFor(() => expect(screen.getByTestId('prints-section')).toBeInTheDocument());
    expect(screen.queryByTestId('prints-load-more')).toBeNull();
  });

  it('refetches when the parent bumps the refresh token', async () => {
    const { rerender } = setup();
    await waitFor(() => expect(api.fetchPrints).toHaveBeenCalledTimes(1));

    rerender(<PrintsSection designId="abc123def456" ownPrint={null} refreshToken={1} />);
    await waitFor(() => expect(api.fetchPrints).toHaveBeenCalledTimes(2));
  });
});
