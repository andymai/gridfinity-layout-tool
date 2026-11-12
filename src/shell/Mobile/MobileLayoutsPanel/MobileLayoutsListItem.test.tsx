import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LayoutListItem, findEntry } from './MobileLayoutsListItem';
import { resetAllStores } from '@/test/testUtils';
import type { LayoutEntry } from '@/core/types';
import { gridUnits, heightUnits, layoutId } from '@/core/types';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

beforeEach(() => {
  resetAllStores();
});

vi.mock('@/shared/components/LayoutThumbnail', () => ({
  LayoutThumbnail: () => <div data-testid="thumbnail" />,
}));

function makeEntry(overrides: Partial<LayoutEntry> = {}): LayoutEntry {
  return {
    id: layoutId('entry-1'),
    name: 'My Layout',
    createdAt: 0,
    modifiedAt: 0,
    preview: {
      drawerWidth: gridUnits(10),
      drawerDepth: gridUnits(8),
      drawerHeight: heightUnits(12),
      binCount: 4,
      layerCount: 1,
      binMap: [],
    },
    ...overrides,
  };
}

const noopHandlers = {
  onRename: vi.fn(),
  onShare: vi.fn(),
  onDuplicate: vi.fn(),
  onDelete: vi.fn(),
  onTouchStart: vi.fn(),
  onTouchMove: vi.fn(),
  onTouchEnd: vi.fn(),
  formatRelativeDate: () => 'just now',
};

describe('findEntry', () => {
  it('finds an entry by id', () => {
    const entries = [makeEntry({ id: layoutId('a') }), makeEntry({ id: layoutId('b') })];
    expect(findEntry(entries, 'b')?.id).toBe('b');
  });

  it('returns undefined when not found', () => {
    expect(findEntry([makeEntry({ id: layoutId('a') })], 'missing')).toBeUndefined();
  });
});

describe('LayoutListItem', () => {
  it('renders the layout name', () => {
    render(
      <LayoutListItem
        entry={makeEntry()}
        isActive={false}
        isSwiping={false}
        swipeX={0}
        canDelete
        onSelect={vi.fn()}
        {...noopHandlers}
      />
    );
    expect(screen.getByText('My Layout')).toBeInTheDocument();
  });

  it('calls onSelect when the row is clicked', () => {
    const onSelect = vi.fn();
    render(
      <LayoutListItem
        entry={makeEntry({ id: layoutId('entry-1') })}
        isActive={false}
        isSwiping={false}
        swipeX={0}
        canDelete
        onSelect={onSelect}
        {...noopHandlers}
      />
    );
    fireEvent.click(screen.getByText('My Layout'));
    expect(onSelect).toHaveBeenCalledWith('entry-1');
  });

  it('counts layers with a plural form', () => {
    const entry = makeEntry();
    entry.preview.layerCount = 2;
    render(
      <LayoutListItem
        entry={entry}
        isActive={false}
        isSwiping={false}
        swipeX={0}
        canDelete
        onSelect={vi.fn()}
        {...noopHandlers}
      />
    );
    expect(screen.getByText('layouts.import.layers_other')).toBeInTheDocument();
  });

  it.each([
    [1, 'mobile.layouts.previewBins_one'],
    [2, 'mobile.layouts.previewBins_other'],
  ])('counts %i bin(s) with a plural form', (binCount, form) => {
    const entry = makeEntry();
    entry.preview.binCount = binCount;
    render(
      <LayoutListItem
        entry={entry}
        isActive={false}
        isSwiping={false}
        swipeX={0}
        canDelete
        onSelect={vi.fn()}
        {...noopHandlers}
      />
    );
    expect(screen.getByText(form)).toBeInTheDocument();
  });

  it('names each swipe action with a translated label', () => {
    render(
      <LayoutListItem
        entry={makeEntry()}
        isActive={false}
        isSwiping={false}
        swipeX={0}
        canDelete
        onSelect={vi.fn()}
        onMove={vi.fn()}
        {...noopHandlers}
      />
    );
    for (const key of [
      'mobile.layouts.renameAria',
      'mobile.layouts.shareAria',
      'mobile.layouts.duplicateAria',
      'mobile.layouts.moveAria',
      'mobile.layouts.deleteAria',
    ]) {
      expect(screen.getByRole('button', { name: key })).toBeInTheDocument();
    }
  });
});
