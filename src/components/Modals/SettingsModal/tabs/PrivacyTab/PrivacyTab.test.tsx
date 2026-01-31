import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PrivacyTab } from './PrivacyTab';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('zustand/shallow', () => ({
  useShallow: (fn: unknown) => fn,
}));

vi.mock('@/core/store', () => ({
  useSettingsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      settings: { analyticsEnabled: true },
      updateSetting: vi.fn(),
    }),
}));

vi.mock('@/shared/components/Checkbox', () => ({
  Checkbox: ({ checked }: { checked: boolean }) => (
    <input type="checkbox" checked={checked} readOnly />
  ),
}));

vi.mock('@/shared/analytics/posthog', () => ({
  optInAnalytics: vi.fn(),
  optOutAnalytics: vi.fn(),
}));

describe('PrivacyTab', () => {
  it('renders privacy heading', () => {
    render(<PrivacyTab />);
    expect(screen.getByText('settings.privacy')).toBeInTheDocument();
  });

  it('renders analytics toggle', () => {
    render(<PrivacyTab />);
    expect(screen.getByText('settings.helpImprove')).toBeInTheDocument();
  });
});
