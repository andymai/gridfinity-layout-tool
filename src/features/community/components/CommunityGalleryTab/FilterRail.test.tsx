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
    render(<FilterRail items={[]} counts={EMPTY_COUNTS} onCollapse={vi.fn()} headingLevel={3} />);
    const rail = screen.getByTestId('community-filter-rail');
    expect(rail.tagName).toBe('ASIDE');
    expect(rail).toHaveAttribute('aria-label', 'community.gallery.filterPanelLabel');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('holds the filter panel', () => {
    render(<FilterRail items={[]} counts={EMPTY_COUNTS} onCollapse={vi.fn()} headingLevel={3} />);
    expect(screen.getByTestId('community-filter-panel')).toBeInTheDocument();
  });

  // The gallery mounts under two different headings: the gallery dialog's own
  // h2 title, and the /community route's h1. A hardcoded level is a peer of
  // the dialog title in one host or skips a level in the other.
  it.each([2, 3] as const)('titles itself at the depth its host dictates (h%i)', (level) => {
    render(
      <FilterRail items={[]} counts={EMPTY_COUNTS} onCollapse={vi.fn()} headingLevel={level} />
    );
    expect(
      screen.getByRole('heading', { level, name: 'community.gallery.filterPanelLabel' })
    ).toBeInTheDocument();
  });

  it('collapses from its own header control', () => {
    const onCollapse = vi.fn();
    render(
      <FilterRail items={[]} counts={EMPTY_COUNTS} onCollapse={onCollapse} headingLevel={3} />
    );
    fireEvent.click(screen.getByTestId('community-filter-rail-collapse'));
    expect(onCollapse).toHaveBeenCalledOnce();
  });
});
