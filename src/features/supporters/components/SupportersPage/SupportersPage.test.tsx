import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SupportersPage } from './SupportersPage';
import { trackEvent } from '@/shared/analytics/posthog';
import { KOFI_URL } from '@/shared/constants/links';
import supportersData from '../../data/supporters.json';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

describe('SupportersPage', () => {
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the warm heading', () => {
    render(<SupportersPage />);
    expect(screen.getByRole('heading', { name: 'supporters.heading' })).toBeInTheDocument();
  });

  it('renders a bin for a named supporter', () => {
    render(<SupportersPage />);
    // Derive from the data so the test survives supporter-list edits.
    expect(screen.getByText(supportersData.named[0])).toBeInTheDocument();
  });

  it('renders anonymous supporters as equal bins', () => {
    render(<SupportersPage />);
    expect(screen.getAllByText('supporters.anonymous').length).toBeGreaterThan(0);
  });

  it('never renders an email address', () => {
    const { container } = render(<SupportersPage />);
    expect(container.textContent ?? '').not.toContain('@');
  });

  it('fires kofi_clicked with the supporters_page source and opens Ko-fi', () => {
    render(<SupportersPage />);
    fireEvent.click(screen.getByText('supporters.cta.button'));
    expect(trackEvent).toHaveBeenCalledWith('kofi_clicked', { source: 'supporters_page' });
    expect(openSpy).toHaveBeenCalledWith(KOFI_URL, '_blank', 'noopener,noreferrer');
  });
});
