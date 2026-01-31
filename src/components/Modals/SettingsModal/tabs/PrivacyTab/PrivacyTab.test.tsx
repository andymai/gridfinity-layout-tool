import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrivacyTab } from './PrivacyTab';

const mockUpdateSetting = vi.hoisted(() => vi.fn());
const mockOptIn = vi.hoisted(() => vi.fn());
const mockOptOut = vi.hoisted(() => vi.fn());
const mockState = vi.hoisted(() => ({ analyticsEnabled: true }));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('zustand/shallow', () => ({
  useShallow: (fn: unknown) => fn,
}));

vi.mock('@/core/store', () => ({
  useSettingsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      settings: mockState,
      updateSetting: mockUpdateSetting,
    }),
}));

vi.mock('@/shared/components/Checkbox', () => ({
  Checkbox: ({ checked }: { checked: boolean }) => (
    <input type="checkbox" checked={checked} readOnly />
  ),
}));

vi.mock('@/shared/analytics/posthog', () => ({
  optInAnalytics: mockOptIn,
  optOutAnalytics: mockOptOut,
}));

describe('PrivacyTab', () => {
  beforeEach(() => {
    mockUpdateSetting.mockClear();
    mockOptIn.mockClear();
    mockOptOut.mockClear();
    mockState.analyticsEnabled = true;
  });

  it('renders privacy heading', () => {
    render(<PrivacyTab />);
    expect(screen.getByText('settings.privacy')).toBeInTheDocument();
  });

  it('renders analytics toggle', () => {
    render(<PrivacyTab />);
    expect(screen.getByText('settings.helpImprove')).toBeInTheDocument();
  });

  it('checkbox reflects aria-checked state', () => {
    render(<PrivacyTab />);
    const toggle = screen.getByRole('checkbox', { name: 'settings.toggleUsageData' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('clicking when enabled calls updateSetting(false) and optOutAnalytics', () => {
    mockState.analyticsEnabled = true;
    render(<PrivacyTab />);
    const toggle = screen.getByRole('checkbox', { name: 'settings.toggleUsageData' });
    fireEvent.click(toggle);
    expect(mockUpdateSetting).toHaveBeenCalledWith('analyticsEnabled', false);
    expect(mockOptOut).toHaveBeenCalled();
    expect(mockOptIn).not.toHaveBeenCalled();
  });

  it('clicking when disabled calls updateSetting(true) and optInAnalytics', () => {
    mockState.analyticsEnabled = false;
    render(<PrivacyTab />);
    const toggle = screen.getByRole('checkbox', { name: 'settings.toggleUsageData' });
    fireEvent.click(toggle);
    expect(mockUpdateSetting).toHaveBeenCalledWith('analyticsEnabled', true);
    expect(mockOptIn).toHaveBeenCalled();
    expect(mockOptOut).not.toHaveBeenCalled();
  });

  it('keyboard Enter triggers toggle', () => {
    render(<PrivacyTab />);
    const toggle = screen.getByRole('checkbox', { name: 'settings.toggleUsageData' });
    fireEvent.keyDown(toggle, { key: 'Enter' });
    expect(mockUpdateSetting).toHaveBeenCalledWith('analyticsEnabled', false);
  });
});
