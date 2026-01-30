import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageSelector } from './LanguageSelector';

vi.mock('@/core/store', () => ({
  useSettingsStore: vi.fn((selector: unknown) => {
    const state = { updateSetting: vi.fn() };
    return (selector as (s: typeof state) => unknown)(state);
  }),
}));

describe('LanguageSelector', () => {
  it('renders trigger button', () => {
    render(<LanguageSelector />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows locale code', () => {
    render(<LanguageSelector />);
    expect(screen.getByText('EN')).toBeInTheDocument();
  });

  it('opens dropdown on click', () => {
    render(<LanguageSelector />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('has aria-expanded attribute', () => {
    render(<LanguageSelector />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes on Escape key', () => {
    render(<LanguageSelector />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
