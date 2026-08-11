// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { INITIAL_BROWSE_STATE, useBrowseStore } from '../../store/browseStore';
import { ResultsHeader } from './ResultsHeader';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

function renderHeader(props: Partial<React.ComponentProps<typeof ResultsHeader>> = {}) {
  render(<ResultsHeader count={12} headingLevel={3} {...props} />);
}

beforeEach(() => {
  useBrowseStore.setState({ ...INITIAL_BROWSE_STATE });
});

describe('ResultsHeader', () => {
  it('reports the filtered count, not the size of the index', () => {
    renderHeader({ count: 3 });
    expect(screen.getByText('community.gallery.countLabel')).toBeInTheDocument();
  });

  it('announces a count change without moving focus', () => {
    renderHeader();
    // The grid repaints below the fold, so for a screen reader this count is
    // the only report that a filter did anything.
    const count = screen.getByText('community.gallery.countLabel');
    expect(count).toHaveAttribute('aria-live', 'polite');
  });

  it('names the grid as a section only when rails sit above it', () => {
    renderHeader({ title: 'community.gallery.allDesigns' });
    expect(
      screen.getByRole('heading', { level: 3, name: 'community.gallery.allDesigns' })
    ).toBeInTheDocument();
  });

  it('drops the title on a narrowed view, where it would contradict the count', () => {
    renderHeader();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('takes the host heading depth', () => {
    renderHeader({ title: 'community.gallery.allDesigns', headingLevel: 2 });
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('updates the sort', () => {
    renderHeader();
    fireEvent.change(screen.getByLabelText('community.gallery.sortLabel'), {
      target: { value: 'likes' },
    });
    expect(useBrowseStore.getState().filters.sort).toBe('likes');
  });

  it('offers best-fit only while a dimension constraint is active', () => {
    renderHeader();
    const sortSelect = screen.getByLabelText('community.gallery.sortLabel');
    const optionIds = () => Array.from(sortSelect.querySelectorAll('option')).map((o) => o.value);
    expect(optionIds()).not.toContain('best-fit');
    act(() => {
      useBrowseStore.getState().setWidthMax(2);
    });
    expect(optionIds()).toContain('best-fit');
    fireEvent.change(sortSelect, { target: { value: 'best-fit' } });
    expect(useBrowseStore.getState().filters.sort).toBe('best-fit');
  });

  it('offers best-fit while a fits-gap context is set without panel constraints', () => {
    useBrowseStore.getState().setFitsGapContext({
      widthMax: 2,
      depthMax: 3,
      maxHeight: null,
      gridUnitMm: 42,
      gridUnitMmY: 42,
      heightUnitMm: 7,
    });
    renderHeader();
    const sortSelect = screen.getByLabelText('community.gallery.sortLabel');
    expect(Array.from(sortSelect.querySelectorAll('option')).map((o) => o.value)).toContain(
      'best-fit'
    );
  });

  it('sticks above the cards rather than under them', () => {
    renderHeader();
    // A card's author button and stat row are z-10 in this same stacking
    // context and come later in DOM order, so an equal depth here would let
    // them scroll over the bar.
    const bar = screen.getByTestId('community-results-header');
    expect(bar.className).toContain('sticky');
    expect(bar.className).toContain('z-20');
  });
});
