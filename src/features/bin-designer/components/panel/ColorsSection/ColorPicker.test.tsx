import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorPicker } from './ColorPicker';

// Mock i18n
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('ColorPicker', () => {
  it('renders preset color buttons', () => {
    render(<ColorPicker color="#3b82f6" onChange={vi.fn()} />);
    expect(screen.getByTitle('White')).toBeInTheDocument();
    expect(screen.getByTitle('Black')).toBeInTheDocument();
  });

  it('calls onChange when a preset is clicked', () => {
    const onChange = vi.fn();
    render(<ColorPicker color="#3b82f6" onChange={onChange} />);
    fireEvent.click(screen.getByTitle('Red'));
    expect(onChange).toHaveBeenCalledWith('#ef4444');
  });

  it('renders hex input with current color', () => {
    render(<ColorPicker color="#3b82f6" onChange={vi.fn()} />);
    const input = screen.getByDisplayValue('#3b82f6');
    expect(input).toBeInTheDocument();
  });
});
