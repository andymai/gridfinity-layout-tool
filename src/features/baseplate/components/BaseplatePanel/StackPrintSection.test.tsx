import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { mm } from '@/core/types';
import type { StackPrintParams } from '@/core/types';
import { StackPrintSection } from './StackPrintSection';

const enabled: StackPrintParams = { enabled: true, gapMm: mm(0.2) };

describe('StackPrintSection', () => {
  it('renders the toggle without an experimental badge', () => {
    render(<StackPrintSection stackPrint={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole('switch', { name: /vertical stack/i })).toBeInTheDocument();
    expect(screen.queryByText(/Experimental/i)).not.toBeInTheDocument();
  });

  it('enables stacking with air-gap defaults when toggled on', () => {
    const onChange = vi.fn();
    render(<StackPrintSection stackPrint={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: /vertical stack/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
  });

  it('disables stacking (onChange undefined) when toggled off', () => {
    const onChange = vi.fn();
    render(<StackPrintSection stackPrint={enabled} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: /vertical stack/i }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('shows the multi-material hint when enabled', () => {
    render(<StackPrintSection stackPrint={enabled} onChange={vi.fn()} />);
    expect(screen.getByText(/Multi-material/i)).toBeInTheDocument();
  });
});
