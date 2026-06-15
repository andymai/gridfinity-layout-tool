import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { mm } from '@/core/types';
import type { StackPrintParams } from '@/core/types';
import { StackPrintSection } from './StackPrintSection';
import type { StackGroup } from '../../utils/stackPrint';

const groups: StackGroup[] = [{ label: 'plate', quantity: 1 }];

const enabled: StackPrintParams = { enabled: true, gapMm: mm(0.2) };

describe('StackPrintSection', () => {
  it('renders the toggle with the experimental badge', () => {
    render(<StackPrintSection stackPrint={undefined} groups={groups} onChange={vi.fn()} />);
    expect(screen.getByRole('switch', { name: /vertical stack/i })).toBeInTheDocument();
    expect(screen.getByText(/Experimental/i)).toBeInTheDocument();
  });

  it('enables stacking with air-gap defaults when toggled on', () => {
    const onChange = vi.fn();
    render(<StackPrintSection stackPrint={undefined} groups={groups} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: /vertical stack/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
  });

  it('disables stacking (onChange undefined) when toggled off', () => {
    const onChange = vi.fn();
    render(<StackPrintSection stackPrint={enabled} groups={groups} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: /vertical stack/i }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('shows the test-a-small-stack hint and a live summary when enabled', () => {
    render(<StackPrintSection stackPrint={enabled} groups={groups} onChange={vi.fn()} />);
    expect(screen.getByText(/Test a small stack/i)).toBeInTheDocument();
    // 1 group of quantity 1 → 1 plate in 1 stack
    expect(screen.getByText(/1 stacks · 1 plates/i)).toBeInTheDocument();
  });

  it('shows the slicer support-interface separation tip when enabled', () => {
    render(<StackPrintSection stackPrint={enabled} groups={groups} onChange={vi.fn()} />);
    expect(screen.getByText(/support interface/i)).toBeInTheDocument();
  });

  it('shows the features-off notice (connectors, magnets, rounding) when enabled', () => {
    render(<StackPrintSection stackPrint={enabled} groups={groups} onChange={vi.fn()} />);
    expect(
      screen.getByText(/Connectors, magnet holes, and corner rounding are turned off/i)
    ).toBeInTheDocument();
  });
});
