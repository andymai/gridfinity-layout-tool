/**
 * Tests for i18n context and provider.
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { renderHook, render, screen, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  LocaleProvider,
  useTranslation,
  useLocale,
  useFormatting,
  getStaticTranslation,
  _setLoadedEn,
} from '@/i18n/context';
import en from '@/i18n/locales/en';

// Seed the English translation cache so getStaticTranslation works in tests
beforeAll(() => {
  _setLoadedEn(en);
});

afterAll(() => {
  _setLoadedEn(null);
});

describe('getStaticTranslation', () => {
  it('returns translated string for valid key', () => {
    const result = getStaticTranslation('common.save');
    expect(result).toBe('Save');
  });

  it('returns key itself when key is missing', () => {
    const result = getStaticTranslation('nonexistent.key');
    expect(result).toBe('nonexistent.key');
  });

  it('interpolates variables correctly', () => {
    const result = getStaticTranslation('toast.binsDeleted', { count: 5 });
    expect(result).toBe('Deleted 5 bin(s)');
  });

  it('interpolates multiple variables', () => {
    const result = getStaticTranslation('date.daysAgo', { days: 3 });
    expect(result).toBe('3d ago');
  });

  it('returns template without interpolation when vars is undefined', () => {
    const result = getStaticTranslation('common.save', undefined);
    expect(result).toBe('Save');
  });

  it('converts non-string variable values to strings', () => {
    const result = getStaticTranslation('toast.binsDeleted', { count: 42 });
    expect(result).toBe('Deleted 42 bin(s)');
  });
});

describe('LocaleProvider + useTranslation', () => {
  it('provides translation function that returns translated strings', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LocaleProvider initialLocale="en">{children}</LocaleProvider>
    );

    const { result } = renderHook(() => useTranslation(), { wrapper });

    await waitFor(() => {
      expect(result.current('common.save')).toBe('Save');
    });
    expect(result.current('common.cancel')).toBe('Cancel');
  });

  it('falls back to key for missing translation keys', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LocaleProvider initialLocale="en">{children}</LocaleProvider>
    );

    const { result } = renderHook(() => useTranslation(), { wrapper });

    await waitFor(() => {
      expect(result.current('missing.key')).toBe('missing.key');
    });
  });

  it('interpolates variables in translations', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LocaleProvider initialLocale="en">{children}</LocaleProvider>
    );

    const { result } = renderHook(() => useTranslation(), { wrapper });

    await waitFor(() => {
      expect(result.current('toast.binsDeleted', { count: 7 })).toBe('Deleted 7 bin(s)');
    });
  });

  it('handles undefined vars parameter', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LocaleProvider initialLocale="en">{children}</LocaleProvider>
    );

    const { result } = renderHook(() => useTranslation(), { wrapper });

    await waitFor(() => {
      expect(result.current('common.save')).toBe('Save');
    });
  });
});

describe('LocaleProvider + useLocale', () => {
  it('provides locale, setLocale, and isLoading', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LocaleProvider initialLocale="en">{children}</LocaleProvider>
    );

    const { result } = renderHook(() => useLocale(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.locale).toBe('en');
    expect(typeof result.current.setLocale).toBe('function');
  });

  it('provides translation function via context', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LocaleProvider initialLocale="en">{children}</LocaleProvider>
    );

    const { result } = renderHook(() => useLocale(), { wrapper });

    await waitFor(() => {
      expect(result.current.t('common.save')).toBe('Save');
    });
  });

  it('has isLoading false after English locale loads', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LocaleProvider initialLocale="en">{children}</LocaleProvider>
    );

    const { result } = renderHook(() => useLocale(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });
});

describe('useTranslation outside provider', () => {
  it('throws error when used outside LocaleProvider', () => {
    expect(() => {
      renderHook(() => useTranslation());
    }).toThrow('useTranslation must be used within a LocaleProvider');
  });
});

describe('useLocale outside provider', () => {
  it('throws error when used outside LocaleProvider', () => {
    expect(() => {
      renderHook(() => useLocale());
    }).toThrow('useLocale must be used within a LocaleProvider');
  });
});

describe('useFormatting outside provider', () => {
  it('throws error when used outside LocaleProvider', () => {
    expect(() => {
      renderHook(() => useFormatting());
    }).toThrow('useFormatting must be used within a LocaleProvider');
  });
});

describe('useFormatting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Render useFormatting and wait for locale to load (vi.waitFor works with fake timers) */
  async function renderFormattingHook() {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LocaleProvider initialLocale="en">{children}</LocaleProvider>
    );
    const { result } = renderHook(() => useFormatting(), { wrapper });
    await vi.waitFor(() => {
      expect(result.current).not.toBeNull();
    });
    return result;
  }

  it('provides formatting functions and locale', async () => {
    const result = await renderFormattingHook();

    expect(typeof result.current.formatDate).toBe('function');
    expect(typeof result.current.formatNumber).toBe('function');
    expect(typeof result.current.formatRelativeDate).toBe('function');
    expect(result.current.locale).toBe('en');
  });

  describe('formatDate', () => {
    it('formats Date object', async () => {
      const result = await renderFormattingHook();

      const date = new Date('2024-01-15T12:00:00Z');
      const formatted = result.current.formatDate(date);
      expect(formatted).toMatch(/1\/15\/2024/);
    });

    it('formats date string', async () => {
      const result = await renderFormattingHook();

      const formatted = result.current.formatDate('2024-01-15T12:00:00Z');
      expect(formatted).toMatch(/1\/15\/2024/);
    });

    it('formats timestamp number', async () => {
      const result = await renderFormattingHook();

      const timestamp = new Date('2024-01-15T12:00:00Z').getTime();
      const formatted = result.current.formatDate(timestamp);
      expect(formatted).toMatch(/1\/15\/2024/);
    });

    it('respects options parameter', async () => {
      const result = await renderFormattingHook();

      const date = new Date('2024-01-15T12:00:00Z');
      const formatted = result.current.formatDate(date, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      expect(formatted).toMatch(/January/);
    });
  });

  describe('formatNumber', () => {
    it('formats numbers according to locale', async () => {
      const result = await renderFormattingHook();

      const formatted = result.current.formatNumber(1234.56);
      expect(formatted).toBe('1,234.56');
    });

    it('respects options parameter', async () => {
      const result = await renderFormattingHook();

      const formatted = result.current.formatNumber(1234.56, {
        style: 'currency',
        currency: 'USD',
      });
      expect(formatted).toMatch(/\$1,234\.56/);
    });
  });

  describe('formatRelativeDate', () => {
    it('returns "Today" for today', async () => {
      const result = await renderFormattingHook();

      const today = new Date('2024-01-15T12:00:00Z');
      const formatted = result.current.formatRelativeDate(today);
      expect(formatted).toBe('Today');
    });

    it('returns "Yesterday" for yesterday', async () => {
      const result = await renderFormattingHook();

      const yesterday = new Date('2024-01-14T12:00:00Z');
      const formatted = result.current.formatRelativeDate(yesterday);
      expect(formatted).toBe('Yesterday');
    });

    it('returns "Xd ago" for days within a week (short format)', async () => {
      const result = await renderFormattingHook();

      const threeDaysAgo = new Date('2024-01-12T12:00:00Z');
      const formatted = result.current.formatRelativeDate(threeDaysAgo, true);
      expect(formatted).toBe('3d ago');
    });

    it('returns "X days ago" for days within a week (long format)', async () => {
      const result = await renderFormattingHook();

      const threeDaysAgo = new Date('2024-01-12T12:00:00Z');
      const formatted = result.current.formatRelativeDate(threeDaysAgo, false);
      expect(formatted).toBe('3 days ago');
    });

    it('returns formatted date for dates older than 7 days', async () => {
      const result = await renderFormattingHook();

      const tenDaysAgo = new Date('2024-01-05T12:00:00Z');
      const formatted = result.current.formatRelativeDate(tenDaysAgo);
      expect(formatted).toMatch(/1\/5\/2024/);
    });

    it('handles string dates', async () => {
      const result = await renderFormattingHook();

      const formatted = result.current.formatRelativeDate('2024-01-14T12:00:00Z');
      expect(formatted).toBe('Yesterday');
    });

    it('handles timestamp numbers', async () => {
      const result = await renderFormattingHook();

      const yesterday = new Date('2024-01-14T12:00:00Z').getTime();
      const formatted = result.current.formatRelativeDate(yesterday);
      expect(formatted).toBe('Yesterday');
    });

    it('returns "Just now" for dates less than 1 minute ago with includeTime', async () => {
      const result = await renderFormattingHook();

      const justNow = new Date('2024-01-15T11:59:30Z');
      const formatted = result.current.formatRelativeDate(justNow, { includeTime: true });
      expect(formatted).toBe('Just now');
    });

    it('returns "Xm ago" for minutes with includeTime', async () => {
      const result = await renderFormattingHook();

      const fifteenMinutesAgo = new Date('2024-01-15T11:45:00Z');
      const formatted = result.current.formatRelativeDate(fifteenMinutesAgo, {
        includeTime: true,
      });
      expect(formatted).toBe('15m ago');
    });

    it('returns "Xh ago" for hours with includeTime', async () => {
      const result = await renderFormattingHook();

      const threeHoursAgo = new Date('2024-01-15T09:00:00Z');
      const formatted = result.current.formatRelativeDate(threeHoursAgo, { includeTime: true });
      expect(formatted).toBe('3h ago');
    });

    it('respects shortFormat option in object form', async () => {
      const result = await renderFormattingHook();

      const threeDaysAgo = new Date('2024-01-12T12:00:00Z');
      const formatted = result.current.formatRelativeDate(threeDaysAgo, { shortFormat: false });
      expect(formatted).toBe('3 days ago');
    });
  });
});

describe('LocaleProvider setLocale', () => {
  it('calls onLocaleChange callback when locale is changed', async () => {
    const onLocaleChange = vi.fn();

    const wrapper = ({ children }: { children: ReactNode }) => (
      <LocaleProvider initialLocale="en" onLocaleChange={onLocaleChange}>
        {children}
      </LocaleProvider>
    );

    const { result } = renderHook(() => useLocale(), { wrapper });

    // Wait for initial locale load before interacting
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.setLocale('de');
    });

    expect(onLocaleChange).toHaveBeenCalledWith('de');
    expect(onLocaleChange).toHaveBeenCalledTimes(1);
  });

  it('updates locale state when setLocale is called', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LocaleProvider initialLocale="en">{children}</LocaleProvider>
    );

    const { result } = renderHook(() => useLocale(), { wrapper });

    // Wait for initial locale load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.locale).toBe('en');

    await act(async () => {
      result.current.setLocale('de');
    });

    await waitFor(() => {
      expect(result.current.locale).toBe('de');
    });
  });

  it('switches back to English from another locale', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LocaleProvider initialLocale="de">{children}</LocaleProvider>
    );

    const { result } = renderHook(() => useLocale(), { wrapper });

    await waitFor(() => {
      expect(result.current.locale).toBe('de');
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.setLocale('en');
    });

    await waitFor(() => {
      expect(result.current.locale).toBe('en');
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('handles race condition when locale changes rapidly', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LocaleProvider initialLocale="en">{children}</LocaleProvider>
    );

    const { result } = renderHook(() => useLocale(), { wrapper });

    // Wait for initial locale load before interacting
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.setLocale('de');
      result.current.setLocale('fr');
    });

    await waitFor(() => {
      expect(result.current.locale).toBe('fr');
      expect(result.current.isLoading).toBe(false);
    });
  });
});

describe('LocaleProvider with non-English initial locale', () => {
  it('shows loading state initially for non-English locale', () => {
    render(
      <LocaleProvider initialLocale="de">
        <div>Content</div>
      </LocaleProvider>
    );

    const loader = screen.getByRole('status', { name: 'Loading' });
    expect(loader).toBeInTheDocument();
  });

  it('shows content after English locale loads', async () => {
    render(
      <LocaleProvider initialLocale="en">
        <div data-testid="content">Content</div>
      </LocaleProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });
  });

  it('eventually loads non-English locale and shows content', async () => {
    render(
      <LocaleProvider initialLocale="de">
        <div data-testid="content">Content</div>
      </LocaleProvider>
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('content')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('falls back to English when locale loading fails', async () => {
    // Mock a locale loader to throw an error
    vi.doMock('@/i18n/locales/de.json', () => {
      throw new Error('Failed to load');
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <LocaleProvider initialLocale="de">{children}</LocaleProvider>
    );

    const { result } = renderHook(() => useLocale(), { wrapper });

    // Should eventually fall back to English translations
    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 3000 }
    );

    // Translation should work with English fallback
    expect(result.current.t('common.save')).toBe('Save');

    vi.doUnmock('@/i18n/locales/de.json');
  });
});

describe('LocaleProvider document updates', () => {
  beforeEach(() => {
    // Mock document structure for testing
    document.documentElement.lang = 'en';
    document.title = '';

    const metaTags = [
      { name: 'description' },
      { property: 'og:locale' },
      { property: 'og:title' },
      { property: 'og:description' },
      { name: 'twitter:title' },
      { name: 'twitter:description' },
    ];

    metaTags.forEach((tag) => {
      const existing = tag.name
        ? document.querySelector(`meta[name="${tag.name}"]`)
        : document.querySelector(`meta[property="${tag.property}"]`);

      if (!existing) {
        const meta = document.createElement('meta');
        if (tag.name) {
          meta.setAttribute('name', tag.name);
        } else if (tag.property) {
          meta.setAttribute('property', tag.property);
        }
        meta.setAttribute('content', '');
        document.head.appendChild(meta);
      }
    });
  });

  it('updates document lang attribute', async () => {
    render(
      <LocaleProvider initialLocale="en">
        <div>Content</div>
      </LocaleProvider>
    );

    await waitFor(() => {
      expect(document.documentElement.lang).toBe('en');
    });
  });

  it('updates document title with SEO title', async () => {
    render(
      <LocaleProvider initialLocale="en">
        <div>Content</div>
      </LocaleProvider>
    );

    await waitFor(() => {
      expect(document.title).toBe(en['seo.title']);
    });
  });

  it('updates meta description', async () => {
    render(
      <LocaleProvider initialLocale="en">
        <div>Content</div>
      </LocaleProvider>
    );

    await waitFor(() => {
      const meta = document.querySelector('meta[name="description"]');
      expect(meta?.getAttribute('content')).toBe(en['seo.description']);
    });
  });

  it('updates OG locale meta tag', async () => {
    render(
      <LocaleProvider initialLocale="en">
        <div>Content</div>
      </LocaleProvider>
    );

    await waitFor(() => {
      const meta = document.querySelector('meta[property="og:locale"]');
      expect(meta?.getAttribute('content')).toBe('en_US');
    });
  });

  it('updates OG title meta tag', async () => {
    render(
      <LocaleProvider initialLocale="en">
        <div>Content</div>
      </LocaleProvider>
    );

    await waitFor(() => {
      const meta = document.querySelector('meta[property="og:title"]');
      expect(meta?.getAttribute('content')).toBe(en['seo.title']);
    });
  });

  it('updates OG description meta tag', async () => {
    render(
      <LocaleProvider initialLocale="en">
        <div>Content</div>
      </LocaleProvider>
    );

    await waitFor(() => {
      const meta = document.querySelector('meta[property="og:description"]');
      expect(meta?.getAttribute('content')).toBe(en['seo.description']);
    });
  });

  it('updates Twitter title meta tag', async () => {
    render(
      <LocaleProvider initialLocale="en">
        <div>Content</div>
      </LocaleProvider>
    );

    await waitFor(() => {
      const meta = document.querySelector('meta[name="twitter:title"]');
      expect(meta?.getAttribute('content')).toBe(en['seo.title']);
    });
  });

  it('updates Twitter description meta tag', async () => {
    render(
      <LocaleProvider initialLocale="en">
        <div>Content</div>
      </LocaleProvider>
    );

    await waitFor(() => {
      const meta = document.querySelector('meta[name="twitter:description"]');
      expect(meta?.getAttribute('content')).toBe(en['seo.description']);
    });
  });
});
