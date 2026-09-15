import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AboutGridfinity } from './AboutGridfinity';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('AboutGridfinity', () => {
  it('renders a heading and the three definitional paragraphs', () => {
    render(<AboutGridfinity />);
    expect(
      screen.getByRole('heading', { level: 3, name: 'sidebar.about.heading' })
    ).toBeInTheDocument();
    expect(screen.getByText('sidebar.about.definition')).toBeInTheDocument();
    expect(screen.getByText('sidebar.about.spec')).toBeInTheDocument();
    expect(screen.getByText('sidebar.about.origin')).toBeInTheDocument();
  });

  it('omits the inner heading when the parent already shows the title', () => {
    render(<AboutGridfinity heading={false} />);
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
    expect(screen.getByText('sidebar.about.definition')).toBeInTheDocument();
  });

  it('merges a caller className', () => {
    render(<AboutGridfinity className="mb-3" />);
    expect(screen.getByRole('region', { name: 'sidebar.about.heading' })).toHaveClass('mb-3');
  });
});
