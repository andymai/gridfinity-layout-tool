import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExperimentalBadge } from './ExperimentalBadge';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('ExperimentalBadge', () => {
  it('renders the experimental label', () => {
    render(<ExperimentalBadge />);
    expect(screen.getByText('settings.experimental')).toBeInTheDocument();
  });
});
