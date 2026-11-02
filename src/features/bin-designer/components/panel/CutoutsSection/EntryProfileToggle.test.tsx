import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EntryProfileToggle } from './EntryProfileToggle';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const button = (shape: 'chamfer' | 'round') =>
  screen.getByRole('button', { name: `binDesigner.cutouts.entryProfile.${shape}` });

describe('EntryProfileToggle', () => {
  it('marks the current shape and reports a new pick', () => {
    const onChange = vi.fn();
    render(<EntryProfileToggle value="chamfer" onChange={onChange} />);
    expect(button('chamfer')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button('round'));
    expect(onChange).toHaveBeenCalledWith('round');
  });

  it('ignores a pick of the shape already set', () => {
    const onChange = vi.fn();
    render(<EntryProfileToggle value="round" onChange={onChange} />);
    fireEvent.click(button('round'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('marks neither for a mixed selection, and either pick applies', () => {
    const onChange = vi.fn();
    render(<EntryProfileToggle value={null} onChange={onChange} />);
    expect(button('chamfer')).toHaveAttribute('aria-pressed', 'false');
    expect(button('round')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button('chamfer'));
    expect(onChange).toHaveBeenCalledWith('chamfer');
  });
});
