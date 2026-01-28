import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TwoClickDeleteButton, useTwoClickDelete } from '../TwoClickDeleteButton';
import { renderHook, act } from '@testing-library/react';

describe('TwoClickDeleteButton', () => {
  it('renders with initial label', () => {
    render(
      <TwoClickDeleteButton
        onDelete={() => {}}
        label="Delete"
        confirmLabel="Confirm delete"
      />
    );

    expect(screen.getByRole('menuitem')).toHaveTextContent('Delete');
  });

  it('shows confirm label on first click', () => {
    render(
      <TwoClickDeleteButton
        onDelete={() => {}}
        label="Delete"
        confirmLabel="Confirm delete"
      />
    );

    fireEvent.click(screen.getByRole('menuitem'));
    expect(screen.getByRole('menuitem')).toHaveTextContent('Confirm delete');
  });

  it('calls onDelete on second click', () => {
    const onDelete = vi.fn();
    render(
      <TwoClickDeleteButton
        onDelete={onDelete}
        label="Delete"
        confirmLabel="Confirm delete"
      />
    );

    const button = screen.getByRole('menuitem');
    fireEvent.click(button);
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(button);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('shows confirm subtext when provided', () => {
    render(
      <TwoClickDeleteButton
        onDelete={() => {}}
        label="Delete"
        confirmLabel="Confirm delete"
        confirmSubtext="5 items will be removed"
      />
    );

    fireEvent.click(screen.getByRole('menuitem'));
    expect(screen.getByText('5 items will be removed')).toBeInTheDocument();
  });

  it('respects disabled state', () => {
    const onDelete = vi.fn();
    render(
      <TwoClickDeleteButton
        onDelete={onDelete}
        label="Delete"
        confirmLabel="Confirm delete"
        disabled
      />
    );

    const button = screen.getByRole('menuitem');
    expect(button).toBeDisabled();

    fireEvent.click(button);
    fireEvent.click(button);
    expect(onDelete).not.toHaveBeenCalled();
  });
});

describe('useTwoClickDelete hook', () => {
  it('starts in non-confirming state', () => {
    const onDelete = vi.fn();
    const { result } = renderHook(() => useTwoClickDelete(onDelete));

    expect(result.current.isConfirming).toBe(false);
  });

  it('transitions to confirming state on first click', () => {
    const onDelete = vi.fn();
    const { result } = renderHook(() => useTwoClickDelete(onDelete));

    act(() => {
      result.current.handleClick();
    });

    expect(result.current.isConfirming).toBe(true);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('calls onDelete on second click and resets', () => {
    const onDelete = vi.fn();
    const { result } = renderHook(() => useTwoClickDelete(onDelete));

    act(() => {
      result.current.handleClick();
    });
    act(() => {
      result.current.handleClick();
    });

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(result.current.isConfirming).toBe(false);
  });

  it('resets confirming state when reset is called', () => {
    const onDelete = vi.fn();
    const { result } = renderHook(() => useTwoClickDelete(onDelete));

    act(() => {
      result.current.handleClick();
    });
    expect(result.current.isConfirming).toBe(true);

    act(() => {
      result.current.reset();
    });
    expect(result.current.isConfirming).toBe(false);
  });
});
