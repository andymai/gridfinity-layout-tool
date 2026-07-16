import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useLayoutStore } from '@/core/store/layout';
import { resetAllStores, createTestBin, createTestLayout } from '@/test/testUtils';
import { MobileAboutStrip } from './MobileAboutStrip';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
  useLocale: () => ({ locale: 'en' }),
}));

describe('MobileAboutStrip', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('renders the about blurb and content links on an empty grid', () => {
    render(<MobileAboutStrip />);
    expect(screen.getByText('sidebar.about', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'sidebar.learn.whatIs' })).toHaveAttribute(
      'href',
      '/what-is-gridfinity'
    );
    expect(screen.getByRole('link', { name: 'sidebar.learn.guide' })).toHaveAttribute(
      'href',
      '/guide'
    );
    expect(screen.getByRole('link', { name: 'sidebar.learn.generator' })).toHaveAttribute(
      'href',
      '/gridfinity-generator'
    );
  });

  it('renders nothing once the grid has bins', () => {
    useLayoutStore.setState({ layout: createTestLayout({ bins: [createTestBin()] }) });
    const { container } = render(<MobileAboutStrip />);
    expect(container).toBeEmptyDOMElement();
  });
});
