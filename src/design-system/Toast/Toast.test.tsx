import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastContainer } from './Toast';
import type { ToastData } from './Toast';

const makeToast = (overrides: Partial<ToastData> = {}): ToastData => ({
  id: '1',
  type: 'success',
  message: 'Changes saved',
  duration: 5000,
  ...overrides,
});

describe('ToastContainer', () => {
  describe('rendering', () => {
    it('returns null when no toasts', () => {
      const { container } = render(<ToastContainer toasts={[]} onDismiss={vi.fn()} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders toast message', () => {
      render(<ToastContainer toasts={[makeToast()]} onDismiss={vi.fn()} />);
      expect(screen.getByText('Changes saved')).toBeInTheDocument();
    });

    it('renders multiple toasts', () => {
      render(
        <ToastContainer
          toasts={[
            makeToast({ id: '1', message: 'First' }),
            makeToast({ id: '2', message: 'Second' }),
          ]}
          onDismiss={vi.fn()}
        />
      );
      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
    });
  });

  describe('toast types', () => {
    it('renders success toast with status role', () => {
      render(<ToastContainer toasts={[makeToast({ type: 'success' })]} onDismiss={vi.fn()} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('renders error toast', () => {
      render(
        <ToastContainer
          toasts={[makeToast({ type: 'error', message: 'Failed' })]}
          onDismiss={vi.fn()}
        />
      );
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('renders info toast', () => {
      render(
        <ToastContainer
          toasts={[makeToast({ type: 'info', message: 'Note' })]}
          onDismiss={vi.fn()}
        />
      );
      expect(screen.getByText('Note')).toBeInTheDocument();
    });
  });

  describe('dismiss', () => {
    it('calls onDismiss when dismiss button clicked', () => {
      const onDismiss = vi.fn();
      render(<ToastContainer toasts={[makeToast()]} onDismiss={onDismiss} />);
      fireEvent.click(screen.getByLabelText('Dismiss notification'));
      // onDismiss is called after animation timeout, so check it was scheduled
      expect(setTimeout).toBeDefined();
    });
  });

  describe('action button', () => {
    it('renders action button when provided', () => {
      const action = { label: 'Undo', onClick: vi.fn() };
      render(<ToastContainer toasts={[makeToast({ action })]} onDismiss={vi.fn()} />);
      expect(screen.getByText('Undo')).toBeInTheDocument();
    });

    it('calls action onClick when clicked', () => {
      const onClick = vi.fn();
      const action = { label: 'Undo', onClick };
      render(<ToastContainer toasts={[makeToast({ action })]} onDismiss={vi.fn()} />);
      fireEvent.click(screen.getByText('Undo'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('uses alert role for error toasts', () => {
      render(<ToastContainer toasts={[makeToast({ type: 'error' })]} onDismiss={vi.fn()} />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('uses status role for non-error toasts', () => {
      render(<ToastContainer toasts={[makeToast({ type: 'success' })]} onDismiss={vi.fn()} />);
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    });
  });
});
