import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteShareConfirm } from './DeleteShareConfirm';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('DeleteShareConfirm', () => {
  it('renders the trigger button by default', () => {
    render(<DeleteShareConfirm isDeleting={false} onConfirm={vi.fn()} />);
    expect(screen.getByText('share.deleteShareLink')).toBeInTheDocument();
    expect(screen.queryByText('common.delete')).not.toBeInTheDocument();
  });

  it('opens the confirm panel when the trigger is clicked', () => {
    render(<DeleteShareConfirm isDeleting={false} onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByText('share.deleteShareLink'));
    expect(screen.getByText('common.delete')).toBeInTheDocument();
    expect(screen.getByText('common.cancel')).toBeInTheDocument();
  });

  it('calls onConfirm when delete is clicked', () => {
    const onConfirm = vi.fn();
    render(<DeleteShareConfirm isDeleting={false} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('share.deleteShareLink'));
    fireEvent.click(screen.getByText('common.delete'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('returns to trigger state when cancel is clicked', () => {
    render(<DeleteShareConfirm isDeleting={false} onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByText('share.deleteShareLink'));
    fireEvent.click(screen.getByText('common.cancel'));
    expect(screen.getByText('share.deleteShareLink')).toBeInTheDocument();
    expect(screen.queryByText('common.delete')).not.toBeInTheDocument();
  });

  it('shows the deleting state and disables both buttons when isDeleting is true', () => {
    render(<DeleteShareConfirm isDeleting onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByText('share.deleteShareLink'));
    expect(screen.getByText(/Deleting/i)).toBeInTheDocument();

    const deleteBtn = screen.getByText(/Deleting/i).closest('button');
    const cancelBtn = screen.getByText('common.cancel').closest('button');
    expect(deleteBtn).toBeDisabled();
    expect(cancelBtn).toBeDisabled();
  });

  it('stops propagation on all internal clicks (popover click-outside guard)', () => {
    // The real SharePopover attaches a click listener to `document` to detect
    // outside clicks. stopPropagation on internal buttons must prevent that
    // listener from firing, otherwise the popover would close on every click.
    const docHandler = vi.fn();
    document.addEventListener('click', docHandler);

    const onConfirm = vi.fn();
    render(<DeleteShareConfirm isDeleting={false} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByText('share.deleteShareLink'));
    fireEvent.click(screen.getByText('common.delete'));

    expect(docHandler).not.toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalledOnce();

    document.removeEventListener('click', docHandler);
  });
});
