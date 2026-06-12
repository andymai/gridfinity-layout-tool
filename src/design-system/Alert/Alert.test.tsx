import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { Alert } from './Alert';

describe('Alert', () => {
  describe('rendering', () => {
    it('renders children', () => {
      render(<Alert intent="info">Keyboard mode active</Alert>);
      expect(screen.getByText('Keyboard mode active')).toBeInTheDocument();
    });

    it('renders the title as a bold first line', () => {
      render(
        <Alert intent="error" title="Import failed">
          Invalid file
        </Alert>
      );
      const title = screen.getByText('Import failed');
      expect(title).toBeInTheDocument();
      expect(title.className).toContain('font-semibold');
      expect(title.className).toContain('text-error');
    });

    it('renders rich children like lists', () => {
      render(
        <Alert intent="error" title="Import failed">
          <ul>
            <li>Missing drawer size</li>
            <li>Unknown bin shape</li>
          </ul>
        </Alert>
      );
      expect(screen.getByRole('list')).toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });

    it('renders the icon slot hidden from assistive technology', () => {
      render(
        <Alert intent="warning" icon={<svg data-testid="alert-icon" />}>
          Exceeds print bed
        </Alert>
      );
      const icon = screen.getByTestId('alert-icon');
      expect(icon).toBeInTheDocument();
      expect(icon.parentElement).toHaveAttribute('aria-hidden', 'true');
    });

    it('merges className with variant classes', () => {
      render(
        <Alert intent="info" className="custom-class">
          Hint
        </Alert>
      );
      const alert = screen.getByRole('status');
      expect(alert).toHaveClass('custom-class');
      expect(alert.className).toContain('bg-info-muted');
    });
  });

  describe('intent', () => {
    it.each([
      ['error', 'bg-error-muted', 'border-error'],
      ['warning', 'bg-warning-muted', 'border-warning'],
      ['success', 'bg-success-muted', 'border-success'],
      ['info', 'bg-info-muted', 'border-info'],
    ] as const)('applies %s background and border classes', (intent, bg, border) => {
      render(
        <Alert intent={intent} data-testid="alert">
          Message
        </Alert>
      );
      const alert = screen.getByTestId('alert');
      expect(alert.className).toContain(bg);
      expect(alert.className).toContain(border);
    });

    it('uses role alert for error intent', () => {
      render(<Alert intent="error">Failed</Alert>);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it.each(['warning', 'success', 'info'] as const)('uses role status for %s intent', (intent) => {
      render(<Alert intent={intent}>Message</Alert>);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('size', () => {
    it('defaults to sm padding and text', () => {
      render(<Alert intent="info">Hint</Alert>);
      const alert = screen.getByRole('status');
      expect(alert).toHaveClass('p-2');
      expect(alert).toHaveClass('text-xs');
    });

    it('applies md padding and text', () => {
      render(
        <Alert intent="info" size="md">
          Hint
        </Alert>
      );
      const alert = screen.getByRole('status');
      expect(alert).toHaveClass('p-3');
      expect(alert).toHaveClass('text-sm');
    });
  });

  describe('dismiss', () => {
    it('does not render a dismiss button without onDismiss', () => {
      render(<Alert intent="info">Hint</Alert>);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('calls onDismiss when the dismiss button is clicked', () => {
      const onDismiss = vi.fn();
      render(
        <Alert intent="info" onDismiss={onDismiss}>
          Keyboard mode active
        </Alert>
      );
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('uses a custom dismissAriaLabel', () => {
      render(
        <Alert intent="info" onDismiss={vi.fn()} dismissAriaLabel="Close banner">
          Hint
        </Alert>
      );
      expect(screen.getByRole('button', { name: 'Close banner' })).toBeInTheDocument();
    });
  });

  describe('ref forwarding', () => {
    it('forwards the ref to the root element', () => {
      const ref = createRef<HTMLDivElement>();
      render(
        <Alert intent="info" ref={ref}>
          Hint
        </Alert>
      );
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveAttribute('role', 'status');
    });
  });
});
