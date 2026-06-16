import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LayoutListItem, findEntry } from './MobileLayoutsListItem';
import { resetAllStores } from '@/test/testUtils';
import type { LayoutEntry } from '@/core/types';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

beforeEach(() => {
  resetAllStores();
});

vi.mock('@/shell/LayoutThumbnail', () => ({
  LayoutThumbnail: () => <div data-testid="thumbnail" />,
}));

function makeEntry(overrides: Partial<LayoutEntry> = {}): LayoutEntry {
  return {
    id: 'entry-1',
    name: 'My Layout',
    createdAt: 0,
    modifiedAt: 0,
    preview: {
      drawerWidth: 10,
      drawerDepth: 8,
      drawerHeight: 12,
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
    const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })];
    expect(findEntry(entries, 'b')?.id).toBe('b');
  });

  it('returns undefined when not found', () => {
    expect(findEntry([makeEntry({ id: 'a' })], 'missing')).toBeUndefined();
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
        entry={makeEntry({ id: 'entry-1' })}
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
});
