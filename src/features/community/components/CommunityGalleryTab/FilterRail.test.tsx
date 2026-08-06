// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from '@/core/sync/session/useSession';
import { INITIAL_BROWSE_STATE, useBrowseStore } from '../../store/browseStore';
import { FilterRail } from './FilterRail';
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

describe('FilterRail', () => {
  it('is a labelled landmark, not a dialog stacked on the gallery', () => {
    render(<FilterRail items={[]} counts={EMPTY_COUNTS} onCollapse={vi.fn()} />);
    const rail = screen.getByTestId('community-filter-rail');
    expect(rail.tagName).toBe('ASIDE');
    expect(rail).toHaveAttribute('aria-label', 'community.gallery.filterPanelLabel');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('holds the filter panel', () => {
    render(<FilterRail items={[]} counts={EMPTY_COUNTS} onCollapse={vi.fn()} />);
    expect(screen.getByTestId('community-filter-panel')).toBeInTheDocument();
  });

  it('collapses from its own header control', () => {
    const onCollapse = vi.fn();
    render(<FilterRail items={[]} counts={EMPTY_COUNTS} onCollapse={onCollapse} />);
    fireEvent.click(screen.getByTestId('community-filter-rail-collapse'));
    expect(onCollapse).toHaveBeenCalledOnce();
  });
});
