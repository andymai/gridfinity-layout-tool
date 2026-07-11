import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteBaseplateWarningDialog } from './DeleteBaseplateWarningDialog';

describe('DeleteBaseplateWarningDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('does not render when closed', () => {
    render(
      <DeleteBaseplateWarningDialog
        isOpen={false}
        designName="Baseplate 1"
        affectedCount={0}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('renders the design name and the current-layout note when the layout uses it', () => {
    render(
      <DeleteBaseplateWarningDialog
        isOpen
        designName="My Baseplate"
        affectedCount={1}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('My Baseplate')).toBeInTheDocument();
    expect(screen.getByText('Used by the current layout')).toBeInTheDocument();
  });

  it('omits the current-layout note when the layout does not use it', () => {
    render(
      <DeleteBaseplateWarningDialog
        isOpen
        designName="My Baseplate"
        affectedCount={0}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByText('Used by the current layout')).not.toBeInTheDocument();
  });

  it('calls onConfirm when the delete button is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <DeleteBaseplateWarningDialog
        isOpen
        designName="My Baseplate"
        affectedCount={1}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Delete Anyway'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <DeleteBaseplateWarningDialog
        isOpen
        designName="My Baseplate"
        affectedCount={0}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape from a focused child despite the container stopPropagation', () => {
    const onCancel = vi.fn();
    render(
      <DeleteBaseplateWarningDialog
        isOpen
        designName="My Baseplate"
        affectedCount={0}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.keyDown(screen.getByText('Cancel'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
