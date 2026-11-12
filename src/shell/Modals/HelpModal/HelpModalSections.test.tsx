import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TipsSection } from './HelpModalSections';

describe('TipsSection', () => {
  it('names the Mac key in the quick-open tip', () => {
    render(<TipsSection />);
    expect(screen.getByText('Use Ctrl/⌘+O to quickly open the layout manager')).toBeInTheDocument();
    expect(screen.queryByText(/\{\w+\}/)).not.toBeInTheDocument();
  });
});
