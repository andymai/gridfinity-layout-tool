// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from '@/core/sync/session/useSession';
import { INITIAL_BROWSE_STATE, useBrowseStore } from '../../store/browseStore';
import { MobileFilterView } from './MobileFilterView';
import { computeFacetCounts } from './facetCounts';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const EMPTY_COUNTS = computeFacetCounts({
  items: [],
  filters: INITIAL_BROWSE_STATE.filters,
  recentIds: [],
  fitsGapContext: null,
});

beforeEach(() => {
  useBrowseStore.setState({ ...INITIAL_BROWSE_STATE });
  useSessionStore.setState({ status: 'anonymous', user: null });
});

describe('MobileFilterView', () => {
  it('takes over in place rather than stacking a dialog on the gallery', () => {
    render(<MobileFilterView items={[]} counts={EMPTY_COUNTS} onBack={vi.fn()} />);
    expect(screen.getByTestId('community-mobile-filters')).toBeInTheDocument();
    expect(screen.getByTestId('community-filter-panel')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('returns to the results from the back control', () => {
    const onBack = vi.fn();
    render(<MobileFilterView items={[]} counts={EMPTY_COUNTS} onBack={onBack} />);
    fireEvent.click(screen.getByTestId('community-mobile-filters-back'));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('doubles the live result count as the way back', () => {
    const onBack = vi.fn();
    render(<MobileFilterView items={[]} counts={{ ...EMPTY_COUNTS, total: 47 }} onBack={onBack} />);
    const apply = screen.getByTestId('community-mobile-filters-apply');
    expect(apply).toHaveTextContent('community.gallery.showResults');
    fireEvent.click(apply);
    expect(onBack).toHaveBeenCalledOnce();
  });
});
