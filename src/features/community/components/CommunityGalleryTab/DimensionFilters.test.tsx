// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CommunityCard } from '@/shared/types/community';
import { INITIAL_BROWSE_STATE, useBrowseStore } from '../../store/browseStore';
import { DimensionFilters } from './DimensionFilters';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

function card(id: string, overrides: Partial<CommunityCard> = {}): CommunityCard {
  return {
    id,
    name: `Bin ${id}`,
    authorName: 'Andy',
    authorPublicId: 'a'.repeat(32),
    category: 'hardware',
    techniques: ['compartments'],
    metrics: { width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 },
    thumbnailUrl: '',
    isRemix: false,
    featured: false,
    counts: { likes: 0, remixes: 0, exports: 0 },
    createdAt: 1000,
    updatedAt: 1000,
    status: 'live',
    ...overrides,
  };
}

beforeEach(() => {
  useBrowseStore.setState({
    ...INITIAL_BROWSE_STATE,
    items: [
      card('a', { metrics: { width: 62.5, depth: 41.5, height: 21, gridUnitMm: 42 } }),
      card('b', { metrics: { width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 } }),
    ],
  });
});

describe('DimensionFilters', () => {
  it('renders faceted options from the loaded index, half units included', () => {
    render(<DimensionFilters variant="toolbar" />);
    const widthMin = screen.getByLabelText('community.gallery.widthMinLabel');
    const optionLabels = Array.from(widthMin.querySelectorAll('option')).map(
      (option) => option.textContent
    );
    expect(optionLabels).toEqual(['community.gallery.dimensionAny', '1.5', '2']);
  });

  it('writes width bounds to the browse store and clears via the Any sentinel', () => {
    render(<DimensionFilters variant="toolbar" />);
    fireEvent.change(screen.getByLabelText('community.gallery.widthMinLabel'), {
      target: { value: '1.5' },
    });
    expect(useBrowseStore.getState().filters.widthMin).toBe(1.5);
    fireEvent.change(screen.getByLabelText('community.gallery.widthMaxLabel'), {
      target: { value: '2' },
    });
    expect(useBrowseStore.getState().filters.widthMax).toBe(2);
    fireEvent.change(screen.getByLabelText('community.gallery.widthMinLabel'), {
      target: { value: '' },
    });
    expect(useBrowseStore.getState().filters.widthMin).toBeNull();
  });

  it('writes depth bounds and the height ceiling to the browse store', () => {
    render(<DimensionFilters variant="sheet" />);
    fireEvent.change(screen.getByLabelText('community.gallery.depthMinLabel'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('community.gallery.depthMaxLabel'), {
      target: { value: '3' },
    });
    fireEvent.change(screen.getByLabelText('community.gallery.maxHeightLabel'), {
      target: { value: '6' },
    });
    const { filters } = useBrowseStore.getState();
    expect(filters.depthMin).toBe(1);
    expect(filters.depthMax).toBe(3);
    expect(filters.maxHeight).toBe(6);
  });

  it('reflects the current store values in the selects', () => {
    useBrowseStore.getState().setMaxHeight(6);
    render(<DimensionFilters variant="toolbar" />);
    expect(screen.getByLabelText('community.gallery.maxHeightLabel')).toHaveValue('6');
    expect(screen.getByLabelText('community.gallery.widthMinLabel')).toHaveValue('');
  });

  it('shows visible group labels in the sheet variant', () => {
    render(<DimensionFilters variant="sheet" />);
    expect(screen.getByText('community.gallery.widthLabel')).toBeInTheDocument();
    expect(screen.getByText('community.gallery.depthLabel')).toBeInTheDocument();
    expect(screen.getByText('community.gallery.maxHeightLabel')).toBeInTheDocument();
  });
});
