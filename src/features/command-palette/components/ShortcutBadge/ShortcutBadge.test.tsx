import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShortcutBadge } from './ShortcutBadge';

describe('ShortcutBadge', () => {
  it('renders a single key', () => {
    render(<ShortcutBadge keys="K" />);
    expect(screen.getByText('K')).toBeInTheDocument();
  });

  it('renders multiple keys with separator', () => {
    render(<ShortcutBadge keys={['J', 'K']} />);
    expect(screen.getByText('J')).toBeInTheDocument();
    expect(screen.getByText('K')).toBeInTheDocument();
    expect(screen.getByText('/')).toBeInTheDocument();
  });

  it('renders modifier key when modifier prop is set', () => {
    const { container } = render(<ShortcutBadge keys="K" modifier />);
    // Modifier key is platform-dependent (⌘ or Ctrl)
    const kbds = container.querySelectorAll('kbd');
    expect(kbds.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('+')).toBeInTheDocument();
  });

  it('renders Shift key when shift prop is set', () => {
    render(<ShortcutBadge keys="K" shift />);
    expect(screen.getByText('Shift')).toBeInTheDocument();
  });

  it('renders both modifier and shift', () => {
    render(<ShortcutBadge keys="K" modifier shift />);
    expect(screen.getByText('Shift')).toBeInTheDocument();
    const plusSigns = screen.getAllByText('+');
    expect(plusSigns).toHaveLength(2);
  });

  it('applies custom className', () => {
    const { container } = render(<ShortcutBadge keys="K" className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
