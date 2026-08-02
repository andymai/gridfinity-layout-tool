// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ALL_TECHNIQUES } from './galleryFilterOptions';
import { INITIAL_BROWSE_STATE, useBrowseStore } from '../../store/browseStore';
import { GalleryToolbar } from './GalleryToolbar';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

const responsiveMock = vi.hoisted(() => ({ isMobile: false }));
vi.mock('@/shared/hooks/useResponsive', () => ({
  useResponsive: () => responsiveMock,
}));

beforeEach(() => {
  responsiveMock.isMobile = false;
  useBrowseStore.setState({ ...INITIAL_BROWSE_STATE });
});

describe('GalleryToolbar (desktop)', () => {
  it('renders search, the full technique pill enum, category, and sort controls', () => {
    render(<GalleryToolbar />);
    expect(screen.getByLabelText('community.gallery.searchLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('community.gallery.categoryLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('community.gallery.sortLabel')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(ALL_TECHNIQUES.length + 1);
    expect(screen.queryByRole('button', { name: /community.gallery.filters/ })).toBeNull();
  });

  it('writes search text to the browse store and clears it via the clear button', () => {
    render(<GalleryToolbar />);
    const search = screen.getByLabelText('community.gallery.searchLabel');
    fireEvent.change(search, { target: { value: 'screws' } });
    expect(useBrowseStore.getState().filters.searchText).toBe('screws');
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.clearSearch' }));
    expect(useBrowseStore.getState().filters.searchText).toBe('');
  });

  it('updates category and sort filters', () => {
    render(<GalleryToolbar />);
    fireEvent.change(screen.getByLabelText('community.gallery.categoryLabel'), {
      target: { value: 'kitchen' },
    });
    expect(useBrowseStore.getState().filters.category).toBe('kitchen');
    fireEvent.change(screen.getByLabelText('community.gallery.categoryLabel'), {
      target: { value: 'all' },
    });
    expect(useBrowseStore.getState().filters.category).toBeNull();
    fireEvent.change(screen.getByLabelText('community.gallery.sortLabel'), {
      target: { value: 'likes' },
    });
    expect(useBrowseStore.getState().filters.sort).toBe('likes');
  });

  it('selects a technique pill and toggles it off on reselect', () => {
    render(<GalleryToolbar />);
    const pill = screen.getAllByRole('radio')[1];
    fireEvent.click(pill);
    expect(useBrowseStore.getState().filters.technique).toBe(ALL_TECHNIQUES[0]);
    fireEvent.click(pill);
    expect(useBrowseStore.getState().filters.technique).toBeNull();
  });

  it('shows a clear-filters button only when a filter is active', () => {
    render(<GalleryToolbar />);
    expect(screen.queryByRole('button', { name: 'community.gallery.clearFilters' })).toBeNull();
    fireEvent.change(screen.getByLabelText('community.gallery.categoryLabel'), {
      target: { value: 'tools' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.clearFilters' }));
    expect(useBrowseStore.getState().filters.category).toBeNull();
    expect(screen.queryByRole('button', { name: 'community.gallery.clearFilters' })).toBeNull();
  });
});

describe('GalleryToolbar (mobile)', () => {
  beforeEach(() => {
    responsiveMock.isMobile = true;
  });

  it('renders one row with search, compact sort, and a filter button; no inline pills', () => {
    render(<GalleryToolbar />);
    expect(screen.getByLabelText('community.gallery.searchLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('community.gallery.sortLabel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /community.gallery.filters/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('community.gallery.categoryLabel')).toBeNull();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('badges the filter button with the active filter count', () => {
    useBrowseStore.getState().setCategory('tools');
    useBrowseStore.getState().setTechnique('scoop');
    render(<GalleryToolbar />);
    expect(screen.getByText('community.gallery.activeFilterCount')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('opens the filter sheet from the filter button', () => {
    render(<GalleryToolbar />);
    fireEvent.click(screen.getByRole('button', { name: /community.gallery.filters/ }));
    expect(screen.getByText('community.gallery.filterSheetTitle')).toBeInTheDocument();
  });
});
