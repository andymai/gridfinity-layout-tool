// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { err, ok } from '@/core/result';
import type { CommunityPrint } from '@/shared/types/communityPrint';
import { PrintsSection } from './PrintsSection';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const api = vi.hoisted(() => ({ fetchPrints: vi.fn(), setCoverPhoto: vi.fn() }));
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

  it('reports its loaded records upward so the parent can place a photo', async () => {
    const onItemsChange = vi.fn();
    setup({ onItemsChange });

    await waitFor(() => expect(screen.getByTestId('prints-section')).toBeInTheDocument());

    expect(onItemsChange).toHaveBeenLastCalledWith([print('a')]);
  });

  it('reports the appended page too, so Load more photos are addressable', async () => {
    const onItemsChange = vi.fn();
    api.fetchPrints.mockResolvedValueOnce(page([print('a')], 'cursor-1'));
    setup({ onItemsChange });
    await waitFor(() => expect(screen.getByTestId('prints-load-more')).toBeInTheDocument());

    api.fetchPrints.mockResolvedValueOnce(page([print('b')]));
    fireEvent.click(screen.getByTestId('prints-load-more'));

    await waitFor(() => expect(onItemsChange).toHaveBeenLastCalledWith([print('a'), print('b')]));
  });

  it('passes the enlarge handler down to each photo tile', async () => {
    const onOpenPhoto = vi.fn();
    api.fetchPrints.mockResolvedValue(page([print('a', { photos: ['https://blob/x.webp'] })]));
    setup({ onOpenPhoto });
    await waitFor(() => expect(screen.getByTestId('prints-section')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'community.prints.photoAlt' }));

    expect(onOpenPhoto).toHaveBeenCalledWith('a', 0);
  });

  it('refetches when the parent bumps the refresh token', async () => {
    const { rerender } = setup();
    await waitFor(() => expect(api.fetchPrints).toHaveBeenCalledTimes(1));

    rerender(<PrintsSection designId="abc123def456" ownPrint={null} refreshToken={1} />);
    await waitFor(() => expect(api.fetchPrints).toHaveBeenCalledTimes(2));
  });

  describe('post/edit CTA', () => {
    it('is absent when no handler is supplied', async () => {
      setup();
      await waitFor(() => expect(screen.getByTestId('prints-section')).toBeInTheDocument());
      expect(screen.queryByTestId('community-detail-add-print')).toBeNull();
    });

    it('invites a first print when the viewer has none', async () => {
      const onAddPrint = vi.fn();
      setup({ onAddPrint });
      await waitFor(() => expect(screen.getByTestId('prints-section')).toBeInTheDocument());

      const cta = screen.getByTestId('community-detail-add-print');
      expect(cta).toHaveTextContent('community.print.cta');
      fireEvent.click(cta);
      expect(onAddPrint).toHaveBeenCalled();
    });

    it('switches to editing once the viewer has a print', async () => {
      setup({ onAddPrint: vi.fn(), ownPrint: print('a') });
      await waitFor(() => expect(screen.getByTestId('prints-section')).toBeInTheDocument());
      expect(screen.getByTestId('community-detail-add-print')).toHaveTextContent(
        'community.print.editCta'
      );
    });

    // Posting a print does not depend on being able to read the existing ones,
    // so the CTA outlives both the spinner and a failed fetch.
    it('is reachable while the list is still loading', () => {
      setup({ onAddPrint: vi.fn() });
      expect(screen.getByTestId('prints-section-loading')).toBeInTheDocument();
      expect(screen.getByTestId('community-detail-add-print')).toBeInTheDocument();
    });

    it('is reachable after the list fails to load', async () => {
      api.fetchPrints.mockResolvedValue(err({ kind: 'network', code: 'X', message: 'no' }));
      setup({ onAddPrint: vi.fn() });
      await waitFor(() => expect(screen.getByTestId('prints-section-error')).toBeInTheDocument());
      expect(screen.getByTestId('community-detail-add-print')).toBeInTheDocument();
    });
  });

  describe('cover promotion', () => {
    beforeEach(() => {
      api.setCoverPhoto.mockResolvedValue(ok({ coverPhotoUrl: 'https://blob.example/a.webp' }));
      api.fetchPrints.mockResolvedValue(
        page([print('a', { photos: ['https://blob.example/a.webp'] })])
      );
    });

    it('offers no clear action to a non-owner', async () => {
      setup({ coverPhotoUrl: 'https://blob.example/a.webp' });
      await waitFor(() => expect(screen.getByTestId('prints-section')).toBeInTheDocument());
      expect(screen.queryByTestId('prints-clear-cover')).toBeNull();
    });

    it('lets the owner revert to the render', async () => {
      api.setCoverPhoto.mockResolvedValue(ok({ coverPhotoUrl: '' }));
      setup({ isOwner: true, coverPhotoUrl: 'https://blob.example/a.webp' });
      await waitFor(() => expect(screen.getByTestId('prints-clear-cover')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('prints-clear-cover'));

      await waitFor(() => expect(api.setCoverPhoto).toHaveBeenCalledWith('abc123def456', null));
    });

    it('promotes a photo the owner picks', async () => {
      setup({ isOwner: true });
      await waitFor(() => expect(screen.getByTestId('print-promote-0')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('print-promote-0'));

      await waitFor(() =>
        expect(api.setCoverPhoto).toHaveBeenCalledWith(
          'abc123def456',
          'https://blob.example/a.webp'
        )
      );
    });

    it('reverts the label when the server rejects the promotion', async () => {
      api.setCoverPhoto.mockResolvedValue(err({ kind: 'validation', code: 'X', message: 'no' }));
      setup({ isOwner: true });
      await waitFor(() => expect(screen.getByTestId('print-promote-0')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('print-promote-0'));

      // Never left claiming a cover the server refused.
      await waitFor(() => expect(screen.getByTestId('print-promote-0')).toBeInTheDocument());
    });
  });
});
