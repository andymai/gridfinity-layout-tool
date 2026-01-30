import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { STLSearchDropdown } from './STLSearchDropdown';

vi.mock('@/core/store', () => ({
  useSettingsStore: vi.fn(),
}));

vi.mock('@/hooks/useContextMenu', () => ({
  useContextMenu: () => ({
    isOpen: false,
    position: { x: 0, y: 0 },
    show: vi.fn(),
    hide: vi.fn(),
    menuRef: { current: null },
  }),
}));

vi.mock('@/utils/stlSearch', () => ({
  openSTLSearch: vi.fn(),
  formatDimension: (v: number) => `${v}`,
}));

import { useSettingsStore } from '@/core/store';

describe('STLSearchDropdown', () => {
  it('renders button when sites are enabled', () => {
    vi.mocked(useSettingsStore).mockImplementation((selector: unknown) => {
      const state = {
        settings: {
          stlSearchSites: [
            { id: 'thangs', name: 'Thangs', enabled: true, urlTemplate: 'https://thangs.com/{query}' },
            { id: 'printables', name: 'Printables', enabled: true, urlTemplate: 'https://printables.com/{query}' },
          ],
        },
      };
      return (selector as (s: typeof state) => unknown)(state);
    });

    render(<STLSearchDropdown width={2} depth={3} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders nothing when no sites are enabled', () => {
    vi.mocked(useSettingsStore).mockImplementation((selector: unknown) => {
      const state = {
        settings: {
          stlSearchSites: [
            { id: 'thangs', name: 'Thangs', enabled: false, urlTemplate: '' },
          ],
        },
      };
      return (selector as (s: typeof state) => unknown)(state);
    });

    const { container } = render(<STLSearchDropdown width={2} depth={3} />);
    expect(container.firstChild).toBeNull();
  });
});
