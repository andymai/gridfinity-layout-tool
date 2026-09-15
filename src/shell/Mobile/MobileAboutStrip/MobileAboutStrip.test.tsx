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
    expect(screen.getByText(/^sidebar\.about\s/)).toBeInTheDocument();
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

  it('keeps the definitional copy in the DOM behind a collapsed disclosure', () => {
    render(<MobileAboutStrip />);
    expect(screen.getByRole('button', { name: 'sidebar.about.heading' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.getByText('sidebar.about.definition')).toBeInTheDocument();
    expect(screen.getByText('sidebar.about.spec')).toBeInTheDocument();
    expect(screen.getByText('sidebar.about.origin')).toBeInTheDocument();
  });

  it('renders nothing once the grid has bins', () => {
    useLayoutStore.setState({ layout: createTestLayout({ bins: [createTestBin()] }) });
    const { container } = render(<MobileAboutStrip />);
    expect(container).toBeEmptyDOMElement();
  });
});
