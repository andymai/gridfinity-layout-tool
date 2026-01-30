import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectionHeader } from './SectionHeader';

describe('SectionHeader', () => {
  it('renders title text', () => {
    render(<SectionHeader title="Settings" />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders as h3 element', () => {
    render(<SectionHeader title="Test" />);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Test');
  });

  it('applies custom className', () => {
    render(<SectionHeader title="Custom" className="my-class" />);
    expect(screen.getByRole('heading')).toHaveClass('my-class');
  });

  it('has uppercase styling', () => {
    render(<SectionHeader title="Header" />);
    expect(screen.getByRole('heading')).toHaveClass('uppercase');
  });
});
