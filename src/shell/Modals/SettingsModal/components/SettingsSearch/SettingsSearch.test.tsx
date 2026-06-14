import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsSearch } from './SettingsSearch';
import { SettingsNavProvider } from '../../SettingsModalContext';
import type { SettingsSearchResult } from '../../hooks/useSettingsSearch';

const mockResults = vi.hoisted(() => ({ value: [] as SettingsSearchResult[] }));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

vi.mock('../../hooks/useSettingsSearch', () => ({
  useSettingsSearch: () => mockResults.value,
}));

function renderSearch(navigateToSection = vi.fn(), query = '') {
  const onQueryChange = vi.fn();
  const utils = render(
    <SettingsNavProvider value={{ navigateToSection, highlightedSectionId: null }}>
      <SettingsSearch query={query} onQueryChange={onQueryChange} />
    </SettingsNavProvider>
  );
  return { ...utils, onQueryChange, navigateToSection };
}

describe('SettingsSearch', () => {
  beforeEach(() => {
    mockResults.value = [];
  });

  it('renders the search input', () => {
    renderSearch();
    expect(screen.getByPlaceholderText('settings.search.placeholder')).toBeInTheDocument();
  });

  it('forwards typing to onQueryChange', () => {
    const { onQueryChange } = renderSearch();
    fireEvent.change(screen.getByPlaceholderText('settings.search.placeholder'), {
      target: { value: 'theme' },
    });
    expect(onQueryChange).toHaveBeenCalledWith('theme');
  });

  it('shows a results list and navigates on select', () => {
    mockResults.value = [
      { id: 'theme', tabId: 'appearance', label: 'Theme', tabLabel: 'Appearance' },
    ];
    const { navigateToSection, onQueryChange } = renderSearch(vi.fn(), 'theme');
    fireEvent.click(screen.getByRole('option'));
    expect(navigateToSection).toHaveBeenCalledWith('appearance', 'theme');
    expect(onQueryChange).toHaveBeenCalledWith('');
  });

  it('shows a no-results message when nothing matches', () => {
    mockResults.value = [];
    renderSearch(vi.fn(), 'zzz');
    expect(screen.getByText(/settings\.search\.noResults/)).toBeInTheDocument();
  });

  it('Enter selects the active result', () => {
    mockResults.value = [
      { id: 'theme', tabId: 'appearance', label: 'Theme', tabLabel: 'Appearance' },
      { id: 'accent', tabId: 'appearance', label: 'Accent', tabLabel: 'Appearance' },
    ];
    const { navigateToSection } = renderSearch(vi.fn(), 'a');
    const input = screen.getByPlaceholderText('settings.search.placeholder');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(navigateToSection).toHaveBeenCalledWith('appearance', 'accent');
  });
});
