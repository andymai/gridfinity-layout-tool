import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntegrationsTab } from './IntegrationsTab';

const mockUpdateSetting = vi.hoisted(() => vi.fn());

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
          { id: 'printables', name: 'Printables', enabled: false, urlTemplate: '' },
        ],
      },
      updateSetting: mockUpdateSetting,
    }),
}));

vi.mock('@/shared/components/Checkbox', () => ({
  Checkbox: ({ checked }: { checked: boolean }) => (
    <input type="checkbox" checked={checked} readOnly />
  ),
}));

describe('IntegrationsTab', () => {
  beforeEach(() => {
    mockUpdateSetting.mockClear();
  });

  it('renders STL search heading', () => {
    render(<IntegrationsTab />);
    expect(screen.getByText('settings.stlSearch')).toBeInTheDocument();
  });

  it('renders search site names', () => {
    render(<IntegrationsTab />);
    expect(screen.getByText('Thangs')).toBeInTheDocument();
    expect(screen.getByText('Printables')).toBeInTheDocument();
  });

  it('renders checkboxes with correct aria-checked state', () => {
    render(<IntegrationsTab />);
    const thangsRow = screen.getByText('Thangs').closest('[role="checkbox"]');
    const printablesRow = screen.getByText('Printables').closest('[role="checkbox"]');
    expect(thangsRow).toHaveAttribute('aria-checked', 'true');
    expect(printablesRow).toHaveAttribute('aria-checked', 'false');
  });

  it('clicking enabled site calls updateSetting with site toggled off', () => {
    render(<IntegrationsTab />);
    const thangsRow = screen.getByText('Thangs').closest('[role="checkbox"]')!;
    fireEvent.click(thangsRow);
    expect(mockUpdateSetting).toHaveBeenCalledWith('stlSearchSites', [
      { id: 'thangs', name: 'Thangs', enabled: false, urlTemplate: '' },
      { id: 'printables', name: 'Printables', enabled: false, urlTemplate: '' },
    ]);
  });

  it('clicking disabled site calls updateSetting with site toggled on', () => {
    render(<IntegrationsTab />);
    const printablesRow = screen.getByText('Printables').closest('[role="checkbox"]')!;
    fireEvent.click(printablesRow);
    expect(mockUpdateSetting).toHaveBeenCalledWith('stlSearchSites', [
      { id: 'thangs', name: 'Thangs', enabled: true, urlTemplate: '' },
      { id: 'printables', name: 'Printables', enabled: true, urlTemplate: '' },
    ]);
  });

  it('keyboard Space triggers toggle', () => {
    render(<IntegrationsTab />);
    const thangsRow = screen.getByText('Thangs').closest('[role="checkbox"]')!;
    fireEvent.keyDown(thangsRow, { key: ' ' });
    expect(mockUpdateSetting).toHaveBeenCalledWith('stlSearchSites', expect.any(Array));
  });
});
