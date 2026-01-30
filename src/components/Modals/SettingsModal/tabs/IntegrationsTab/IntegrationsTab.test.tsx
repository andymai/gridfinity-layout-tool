import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { IntegrationsTab } from './IntegrationsTab';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('zustand/shallow', () => ({
  useShallow: (fn: unknown) => fn,
}));

vi.mock('@/core/store', () => ({
  useSettingsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      settings: {
        stlSearchSites: [
          { id: 'thangs', name: 'Thangs', enabled: true, urlTemplate: '' },
          { id: 'printables', name: 'Printables', enabled: true, urlTemplate: '' },
        ],
      },
      updateSetting: vi.fn(),
    }),
}));

vi.mock('@/shared/components/Checkbox', () => ({
  Checkbox: ({ checked }: { checked: boolean }) => (
    <input type="checkbox" checked={checked} readOnly />
  ),
}));

describe('IntegrationsTab', () => {
  it('renders STL search heading', () => {
    render(<IntegrationsTab />);
    expect(screen.getByText('settings.stlSearch')).toBeInTheDocument();
  });

  it('renders search site names', () => {
    render(<IntegrationsTab />);
    expect(screen.getByText('Thangs')).toBeInTheDocument();
    expect(screen.getByText('Printables')).toBeInTheDocument();
  });
});
