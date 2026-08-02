// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ALL_TECHNIQUES } from './galleryFilterOptions';
import { INITIAL_BROWSE_STATE, useBrowseStore } from '../../store/browseStore';
import { FilterSheet } from './FilterSheet';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

beforeEach(() => {
  useBrowseStore.setState({ ...INITIAL_BROWSE_STATE });
});

describe('FilterSheet', () => {
  it('renders nothing when closed', () => {
    render(<FilterSheet open={false} onClose={vi.fn()} />);
    expect(screen.queryByText('community.gallery.filterSheetTitle')).toBeNull();
  });

  it('renders the category select and the full technique enum', () => {
    render(<FilterSheet open onClose={vi.fn()} />);
    expect(screen.getByText('community.gallery.filterSheetTitle')).toBeInTheDocument();
    expect(screen.getByLabelText('community.gallery.categoryLabel')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(ALL_TECHNIQUES.length + 1);
  });

  it('writes category and technique selections to the browse store', () => {
    render(<FilterSheet open onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('community.gallery.categoryLabel'), {
      target: { value: 'electronics' },
    });
    expect(useBrowseStore.getState().filters.category).toBe('electronics');
    fireEvent.click(screen.getAllByRole('radio')[1]);
    expect(useBrowseStore.getState().filters.technique).toBe(ALL_TECHNIQUES[0]);
  });

  it('renders the dimension filter controls', () => {
    render(<FilterSheet open onClose={vi.fn()} />);
    expect(screen.getByTestId('community-dimension-filters')).toBeInTheDocument();
    expect(screen.getByLabelText('community.gallery.widthMinLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('community.gallery.depthMaxLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('community.gallery.maxHeightLabel')).toBeInTheDocument();
  });

  it('clear all resets only the sheet filters, keeping search text', () => {
    useBrowseStore.getState().setSearchText('screws');
    useBrowseStore.getState().setCategory('tools');
    useBrowseStore.getState().setTechnique('scoop');
    useBrowseStore.getState().setWidthMin(1);
    useBrowseStore.getState().setWidthMax(2);
    useBrowseStore.getState().setDepthMin(1);
    useBrowseStore.getState().setDepthMax(3);
    useBrowseStore.getState().setMaxHeight(6);
    render(<FilterSheet open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.clearAll' }));
    const { filters } = useBrowseStore.getState();
    expect(filters.category).toBeNull();
    expect(filters.technique).toBeNull();
    expect(filters.widthMin).toBeNull();
    expect(filters.widthMax).toBeNull();
    expect(filters.depthMin).toBeNull();
    expect(filters.depthMax).toBeNull();
    expect(filters.maxHeight).toBeNull();
    expect(filters.searchText).toBe('screws');
  });

  it('closes via the done button', () => {
    const onClose = vi.fn();
    render(<FilterSheet open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'common.done' }));
    expect(onClose).toHaveBeenCalled();
  });
});
