import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrintBedInput } from './PrintBedInput';

describe('PrintBedInput', () => {
  it('renders single input when width equals depth', () => {
    render(<PrintBedInput width={256} depth={256} onChange={vi.fn()} />);
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(1);
  });

  it('renders two inputs when width differs from depth', () => {
    render(<PrintBedInput width={256} depth={210} onChange={vi.fn()} />);
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(2);
  });

  it('shows two inputs after clicking unlink button', () => {
    render(<PrintBedInput width={256} depth={256} onChange={vi.fn()} />);
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1);

    const unlinkBtn = screen.getByRole('button');
    fireEvent.click(unlinkBtn);

    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
  });

  it('calls onChange with width only when linked (square bed)', () => {
    const onChange = vi.fn();
    render(<PrintBedInput width={256} depth={256} onChange={onChange} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '300' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(300);
  });

  it('re-links when link button is clicked in expanded mode', () => {
    const onChange = vi.fn();
    render(<PrintBedInput width={256} depth={210} onChange={onChange} />);
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);

    const linkBtn = screen.getByRole('button');
    fireEvent.click(linkBtn);

    expect(onChange).toHaveBeenCalledWith(256);
  });

  it('forwards id to the first input', () => {
    render(<PrintBedInput id="testId" width={256} depth={256} onChange={vi.fn()} />);
    expect(screen.getByRole('spinbutton').id).toBe('testId');
  });

  it('renders link icon for square bed and unlink icon for asymmetric', () => {
    const { rerender } = render(<PrintBedInput width={256} depth={256} onChange={vi.fn()} />);
    const linkedPaths = screen.getByRole('button').querySelectorAll('path');
    expect(linkedPaths.length).toBe(1);

    rerender(<PrintBedInput width={256} depth={210} onChange={vi.fn()} />);
    const unlinkedPaths = screen.getByRole('button').querySelectorAll('path');
    expect(unlinkedPaths.length).toBeGreaterThan(1);
  });
});
