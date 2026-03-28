import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MobileTitleBar } from './MobileTitleBar';

describe('MobileTitleBar', () => {
  it('renders app name', () => {
    render(<MobileTitleBar />);
    expect(screen.getByText(/gridfinity layout tool/i)).toBeInTheDocument();
  });

  it('renders Ko-fi link', () => {
    render(<MobileTitleBar />);
    const link = screen.getByRole('link', { name: /tip/i });
    expect(link).toHaveAttribute('href', 'https://ko-fi.com/andyaragon');
  });

  it('renders GitHub link', () => {
    render(<MobileTitleBar />);
    const link = screen.getByRole('link', { name: /github/i });
    expect(link).toHaveAttribute('href', 'https://github.com/andymai/gridfinity-layout-tool');
  });
});
