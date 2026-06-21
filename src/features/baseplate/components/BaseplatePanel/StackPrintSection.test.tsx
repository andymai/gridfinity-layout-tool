import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { mm } from '@/core/types';
import type { StackPrintParams } from '@/core/types';
import { resetAllStores } from '@/test/testUtils';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { StackPrintSection } from './StackPrintSection';

const enabled: StackPrintParams = { enabled: true, gapMm: mm(0.2) };

describe('StackPrintSection', () => {
  afterEach(() => {
    resetAllStores();
  });

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

  it('warns when there is nothing to stack (default state has no split, single plate)', () => {
    // With no split tiling in the store and copies=1, the drawer is a single
    // plate → stacking has nothing to combine, so the panel surfaces the warning.
    render(<StackPrintSection stackPrint={enabled} onChange={vi.fn()} />);
    expect(screen.getByText(/makes a single plate/i)).toBeInTheDocument();
  });

  it('shows no warning when stacking is disabled', () => {
    render(<StackPrintSection stackPrint={undefined} onChange={vi.fn()} />);
    expect(screen.queryByText(/makes a single plate/i)).not.toBeInTheDocument();
  });

  it('renders the copies stepper when enabled', () => {
    render(<StackPrintSection stackPrint={enabled} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Increase Copies')).toBeInTheDocument();
  });

  it('increments the copy count through onChange', () => {
    const onChange = vi.fn();
    render(<StackPrintSection stackPrint={{ ...enabled, copies: 2 }} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Increase Copies'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, copies: 3 }));
  });

  it('shows the output summary instead of the warning once copies stack a single plate', () => {
    // The summary reads the plan from the layout store, so set copies there too.
    useLayoutStore.getState().setBaseplateParams({
      ...DEFAULT_BASEPLATE_PARAMS,
      stackPrint: { enabled: true, gapMm: mm(0.2), copies: 3 },
    });
    render(<StackPrintSection stackPrint={{ ...enabled, copies: 3 }} onChange={vi.fn()} />);
    expect(screen.queryByText(/makes a single plate/i)).not.toBeInTheDocument();
    expect(screen.getByText(/3 plates stacked into 1 print file/i)).toBeInTheDocument();
  });
});
