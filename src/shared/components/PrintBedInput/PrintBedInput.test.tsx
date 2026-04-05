import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrintBedInput } from './PrintBedInput';

describe('PrintBedInput', () => {
  it('renders single input when width equals depth', () => {
    render(
      <PrintBedInput width={256} depth={256} onWidthChange={vi.fn()} onDepthChange={vi.fn()} />
    );
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(1);
  });

  it('renders two inputs when width differs from depth', () => {
    render(
      <PrintBedInput width={256} depth={210} onWidthChange={vi.fn()} onDepthChange={vi.fn()} />
    );
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(2);
  });

  it('shows two inputs after clicking unlink button', () => {
    render(
      <PrintBedInput width={256} depth={256} onWidthChange={vi.fn()} onDepthChange={vi.fn()} />
    );
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1);

    const unlinkBtn = screen.getByRole('button');
    fireEvent.click(unlinkBtn);

    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
  });

  it('calls both onWidthChange and onDepthChange when linked', () => {
    const onWidth = vi.fn();
    const onDepth = vi.fn();
    render(
      <PrintBedInput width={256} depth={256} onWidthChange={onWidth} onDepthChange={onDepth} />
    );
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '300' } });
    fireEvent.blur(input);

    expect(onWidth).toHaveBeenCalledWith(300);
    expect(onDepth).toHaveBeenCalledWith(300);
  });

  it('re-links when link button is clicked in expanded mode', () => {
    const onDepth = vi.fn();
    render(
      <PrintBedInput width={256} depth={210} onWidthChange={vi.fn()} onDepthChange={onDepth} />
    );
    // Should show two inputs (asymmetric)
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);

    // Click link button — should call onDepthChange(width)
    const linkBtn = screen.getByRole('button');
    fireEvent.click(linkBtn);

    expect(onDepth).toHaveBeenCalledWith(256);
  });

  it('renders link icon for square bed and unlink icon for asymmetric', () => {
    const { rerender } = render(
      <PrintBedInput width={256} depth={256} onWidthChange={vi.fn()} onDepthChange={vi.fn()} />
    );
    // Linked state has one SVG path (link icon)
    const linkedPaths = screen.getByRole('button').querySelectorAll('path');
    expect(linkedPaths.length).toBe(1);

    rerender(
      <PrintBedInput width={256} depth={210} onWidthChange={vi.fn()} onDepthChange={vi.fn()} />
    );
    // Unlinked state has multiple SVG paths (unlink icon)
    const unlinkedPaths = screen.getByRole('button').querySelectorAll('path');
    expect(unlinkedPaths.length).toBeGreaterThan(1);
  });
});
