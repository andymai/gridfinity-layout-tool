import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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
    // Dispatch a native event on the focused child so it propagates through the
    // container's stopPropagation. Only a capture-phase document listener fires
    // before that stop; a bubble-phase one would be starved (see the container's
    // onKeyDown). fireEvent.keyDown wouldn't exercise this — it invokes React
    // handlers directly rather than dispatching through the DOM.
    act(() => {
      screen
        .getByText('Cancel')
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
