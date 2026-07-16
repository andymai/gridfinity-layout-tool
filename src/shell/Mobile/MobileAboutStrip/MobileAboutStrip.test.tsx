import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MobileAboutStrip } from './MobileAboutStrip';

let binCount = 0;

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
  useLocale: () => ({ locale: 'en' }),
}));

vi.mock('@/core/store/layout', () => ({
  useLayoutStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      layout: {
        get bins() {
          return Array.from({ length: binCount });
        },
      },
    }),
}));

describe('MobileAboutStrip', () => {
  it('renders the about blurb and content links on an empty grid', () => {
    binCount = 0;
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
    binCount = 3;
    const { container } = render(<MobileAboutStrip />);
    expect(container).toBeEmptyDOMElement();
  });
});
