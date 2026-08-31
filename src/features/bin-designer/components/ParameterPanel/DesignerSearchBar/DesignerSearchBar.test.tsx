import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DesignerSearchBar } from './DesignerSearchBar';
import { useDesignerStore } from '@/features/bin-designer/store';
import { jumpToDesignerControl } from '@/features/bin-designer/settingsManifest';

vi.mock('@/features/bin-designer/settingsManifest', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, jumpToDesignerControl: vi.fn() };
});

describe('DesignerSearchBar', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
    vi.mocked(jumpToDesignerControl).mockClear();
  });

  const open = () => {
    render(<DesignerSearchBar viewMode="rail" needsSplit={false} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    return input;
  };

  it('lists controls for browsing when focused with an empty query', () => {
    open();
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getAllByRole('option').length).toBeGreaterThan(1);
    expect(within(listbox).getByText('Bin dimensions')).toBeInTheDocument();
  });

  it('filters the list as the user types', () => {
    const input = open();
    fireEvent.change(input, { target: { value: 'scoop' } });
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByText('Finger scoop')).toBeInTheDocument();
    expect(within(listbox).queryByText('Bin dimensions')).not.toBeInTheDocument();
  });

  it('jumps to the control and clears the query when a result is chosen', () => {
    const input = open();
    fireEvent.change(input, { target: { value: 'scoop' } });
    fireEvent.click(screen.getByText('Finger scoop'));
    expect(jumpToDesignerControl).toHaveBeenCalledWith('bd-scoop');
    expect((input as HTMLInputElement).value).toBe('');
  });
});
