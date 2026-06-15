import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { StackPrintParams } from '@/core/types';
import { StackPrintSection } from './StackPrintSection';
import type { StackGroup } from '../../utils/stackPrint';

const groups: StackGroup[] = [{ label: 'plate', quantity: 1 }];

const enabled: StackPrintParams = { enabled: true, sets: 3, gapMm: 0.2 as never, mode: 'airGap' };

describe('StackPrintSection', () => {
  it('renders the section header with the experimental badge', () => {
    render(
      <StackPrintSection
        stackPrint={undefined}
        groups={groups}
        isSplit={false}
        hadMagnets={false}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText(/Stack for printing/i)).toBeInTheDocument();
    expect(screen.getByText(/Experimental/i)).toBeInTheDocument();
  });

  it('enables stacking with air-gap defaults when toggled on', () => {
    const onChange = vi.fn();
    render(
      <StackPrintSection
        stackPrint={undefined}
        groups={groups}
        isSplit={false}
        hadMagnets={false}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole('switch', { name: /vertical stack/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, mode: 'airGap', sets: expect.any(Number) })
    );
  });

  it('disables stacking (onChange undefined) when toggled off', () => {
    const onChange = vi.fn();
    render(
      <StackPrintSection
        stackPrint={enabled}
        groups={groups}
        isSplit={false}
        hadMagnets={false}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole('switch', { name: /vertical stack/i }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('shows the test-a-small-stack hint and a live summary when enabled', () => {
    render(
      <StackPrintSection
        stackPrint={enabled}
        groups={groups}
        isSplit={false}
        hadMagnets={false}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText(/Test a small stack/i)).toBeInTheDocument();
    // 1 group * 3 sets = 3 plates in 1 stack
    expect(screen.getByText(/1 stacks · 3 plates/i)).toBeInTheDocument();
  });

  it('shows the 3MF notice in sacrificial-sheet mode', () => {
    render(
      <StackPrintSection
        stackPrint={{ ...enabled, mode: 'sacrificialSheet' }}
        groups={groups}
        isSplit={false}
        hadMagnets={false}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText(/3MF/i)).toBeInTheDocument();
  });

  it('warns that connectors are disabled when the plate is split', () => {
    render(
      <StackPrintSection
        stackPrint={enabled}
        groups={groups}
        isSplit
        hadMagnets={false}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText(/Connectors are turned off/i)).toBeInTheDocument();
  });

  it('warns that magnet holes are disabled when the plate has magnets', () => {
    render(
      <StackPrintSection
        stackPrint={enabled}
        groups={groups}
        isSplit={false}
        hadMagnets
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText(/Magnet holes are turned off/i)).toBeInTheDocument();
  });
});
