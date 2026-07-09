import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccessibilityTab } from './AccessibilityTab';

const mockUpdateSetting = vi.hoisted(() => vi.fn());
const mockState = vi.hoisted(() => ({
  reduceMotion: false,
  highContrast: false,
  distinguishCategoriesByPattern: false,
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('zustand/react/shallow', () => ({
  useShallow: (fn: unknown) => fn,
}));

vi.mock('@/core/store', () => ({
  useSettingsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      settings: mockState,
      updateSetting: mockUpdateSetting,
    }),
}));

describe('AccessibilityTab', () => {
  beforeEach(() => {
    mockUpdateSetting.mockClear();
    mockState.reduceMotion = false;
    mockState.highContrast = false;
    mockState.distinguishCategoriesByPattern = false;
  });

  it('renders all section headings', () => {
    render(<AccessibilityTab />);
    expect(screen.getByText('settings.reduceMotion')).toBeInTheDocument();
    expect(screen.getByText('settings.highContrast')).toBeInTheDocument();
    expect(screen.getByText('settings.categoryPatterns')).toBeInTheDocument();
  });

  it('toggling reduce motion calls updateSetting', () => {
    render(<AccessibilityTab />);
    fireEvent.click(screen.getByRole('switch', { name: 'settings.reduceMotion' }));
    expect(mockUpdateSetting).toHaveBeenCalledWith('reduceMotion', true);
  });

  it('toggling high contrast calls updateSetting', () => {
    render(<AccessibilityTab />);
    fireEvent.click(screen.getByRole('switch', { name: 'settings.highContrast' }));
    expect(mockUpdateSetting).toHaveBeenCalledWith('highContrast', true);
  });

  it('toggling category patterns calls updateSetting', () => {
    render(<AccessibilityTab />);
    fireEvent.click(screen.getByRole('switch', { name: 'settings.categoryPatterns' }));
    expect(mockUpdateSetting).toHaveBeenCalledWith('distinguishCategoriesByPattern', true);
  });
});
