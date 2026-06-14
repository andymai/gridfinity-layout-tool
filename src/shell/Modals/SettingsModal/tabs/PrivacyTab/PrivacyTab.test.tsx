import type * as DesignSystem from '@/design-system';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrivacyTab } from './PrivacyTab';

const mockUpdateSetting = vi.hoisted(() => vi.fn());
const mockOptIn = vi.hoisted(() => vi.fn());
const mockOptOut = vi.hoisted(() => vi.fn());
const mockPruneAnalytics = vi.hoisted(() => vi.fn());
const mockIsTrackingOptOut = vi.hoisted(() => vi.fn(() => false));
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

vi.mock('@/design-system', async (importActual) => {
  const actual = await importActual<typeof DesignSystem>();
  return {
    ...actual,
    Checkbox: ({ checked }: { checked: boolean }) => (
      <input type="checkbox" checked={checked} readOnly />
    ),
  };
});

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
  optInAnalytics: mockOptIn,
  optOutAnalytics: mockOptOut,
  pruneAnalyticsData: mockPruneAnalytics,
  isTrackingOptOut: mockIsTrackingOptOut,
}));

describe('PrivacyTab', () => {
  beforeEach(() => {
    mockUpdateSetting.mockClear();
    mockOptIn.mockClear();
    mockOptOut.mockClear();
    mockPruneAnalytics.mockClear();
    mockIsTrackingOptOut.mockReturnValue(false);
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

  it('switch reflects checked state', () => {
    render(<PrivacyTab />);
    const toggle = screen.getByRole('switch', { name: 'settings.toggleUsageData' });
    expect(toggle).toBeChecked();
  });

  it('clicking when enabled calls updateSetting(false) and optOutAnalytics', () => {
    mockState.analyticsEnabled = true;
    render(<PrivacyTab />);
    const toggle = screen.getByRole('switch', { name: 'settings.toggleUsageData' });
    fireEvent.click(toggle);
    expect(mockUpdateSetting).toHaveBeenCalledWith('analyticsEnabled', false);
    expect(mockOptOut).toHaveBeenCalled();
    expect(mockOptIn).not.toHaveBeenCalled();
  });

  it('prunes analytics data when disabling analytics', () => {
    mockState.analyticsEnabled = true;
    render(<PrivacyTab />);
    const toggle = screen.getByRole('switch', { name: 'settings.toggleUsageData' });
    fireEvent.click(toggle);
    expect(mockPruneAnalytics).toHaveBeenCalledTimes(1);
  });

  it('does not prune analytics data when enabling analytics', () => {
    mockState.analyticsEnabled = false;
    render(<PrivacyTab />);
    const toggle = screen.getByRole('switch', { name: 'settings.toggleUsageData' });
    fireEvent.click(toggle);
    expect(mockPruneAnalytics).not.toHaveBeenCalled();
  });

  it('clicking when disabled calls updateSetting(true) and optInAnalytics', () => {
    mockState.analyticsEnabled = false;
    render(<PrivacyTab />);
    const toggle = screen.getByRole('switch', { name: 'settings.toggleUsageData' });
    fireEvent.click(toggle);
    expect(mockUpdateSetting).toHaveBeenCalledWith('analyticsEnabled', true);
    expect(mockOptIn).toHaveBeenCalled();
    expect(mockOptOut).not.toHaveBeenCalled();
  });

  it('shows privacy signal banner when browser signal detected and analytics disabled', () => {
    mockIsTrackingOptOut.mockReturnValue(true);
    mockState.analyticsEnabled = false;
    render(<PrivacyTab />);
    expect(screen.getByText('settings.browserPrivacySignal')).toBeInTheDocument();
  });

  it('hides privacy signal banner when user explicitly enables analytics', () => {
    mockIsTrackingOptOut.mockReturnValue(true);
    mockState.analyticsEnabled = true;
    render(<PrivacyTab />);
    expect(screen.queryByText('settings.browserPrivacySignal')).not.toBeInTheDocument();
  });

  it('does not show privacy signal banner when no signal', () => {
    mockIsTrackingOptOut.mockReturnValue(false);
    render(<PrivacyTab />);
    expect(screen.queryByText('settings.browserPrivacySignal')).not.toBeInTheDocument();
  });
});
