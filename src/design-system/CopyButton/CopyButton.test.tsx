import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { createRef } from 'react';
import { CopyButton } from './CopyButton';

const writeText = vi.fn<(text: string) => Promise<void>>();

async function clickAndSettle(element: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.click(element);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('CopyButton', () => {
  describe('copying', () => {
    it('copies the value to the clipboard', async () => {
      render(<CopyButton value="hello" aria-label="Copy value" />);

      await clickAndSettle(screen.getByRole('button', { name: 'Copy value' }));

      expect(writeText).toHaveBeenCalledWith('hello');
    });

    it('resolves a lazy getter at click time', async () => {
      const getValue = vi.fn(() => 'computed payload');
      render(<CopyButton value={getValue} aria-label="Copy value" />);

      expect(getValue).not.toHaveBeenCalled();
      await clickAndSettle(screen.getByRole('button', { name: 'Copy value' }));

      expect(getValue).toHaveBeenCalledTimes(1);
      expect(writeText).toHaveBeenCalledWith('computed payload');
    });

    it('calls onCopied after a successful copy', async () => {
      const onCopied = vi.fn();
      render(<CopyButton value="hello" aria-label="Copy value" onCopied={onCopied} />);

      await clickAndSettle(screen.getByRole('button', { name: 'Copy value' }));

      expect(onCopied).toHaveBeenCalledTimes(1);
    });

    it('does not copy when disabled', async () => {
      render(<CopyButton value="hello" aria-label="Copy value" disabled />);

      await clickAndSettle(screen.getByRole('button', { name: 'Copy value' }));

      expect(writeText).not.toHaveBeenCalled();
    });
  });

  describe('copied state', () => {
    it('shows the copied label and reverts after the timeout', async () => {
      render(<CopyButton value="hello" aria-label="Copy value" label="Copy" />);
      const button = screen.getByRole('button', { name: 'Copy value' });

      expect(button).toHaveTextContent('Copy');
      await clickAndSettle(button);
      expect(button).toHaveTextContent('Copied');

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(button).not.toHaveTextContent('Copied');
      expect(button).toHaveTextContent('Copy');
    });

    it('swaps the icon to a success check while copied', async () => {
      render(<CopyButton value="hello" aria-label="Copy value" />);
      const button = screen.getByRole('button', { name: 'Copy value' });

      expect(screen.queryByTestId('copy-button-check-icon')).not.toBeInTheDocument();
      await clickAndSettle(button);

      const check = screen.getByTestId('copy-button-check-icon');
      expect(check.closest('svg')?.getAttribute('class')).toContain('text-success');
    });

    it('respects a custom timeoutMs', async () => {
      render(<CopyButton value="hello" aria-label="Copy value" label="Copy" timeoutMs={500} />);
      const button = screen.getByRole('button', { name: 'Copy value' });

      await clickAndSettle(button);
      expect(button).toHaveTextContent('Copied');

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(button).toHaveTextContent('Copy');
    });

    it('resets the timer on re-click', async () => {
      render(<CopyButton value="hello" aria-label="Copy value" label="Copy" />);
      const button = screen.getByRole('button', { name: 'Copy value' });

      await clickAndSettle(button);
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      await clickAndSettle(button);
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(button).toHaveTextContent('Copied');

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(button).toHaveTextContent('Copy');
    });

    it('clears the pending timer on unmount', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { unmount } = render(<CopyButton value="hello" aria-label="Copy value" />);

      await clickAndSettle(screen.getByRole('button', { name: 'Copy value' }));
      expect(vi.getTimerCount()).toBe(1);

      unmount();

      expect(vi.getTimerCount()).toBe(0);
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('keeps a stable aria-label while copied', async () => {
      render(<CopyButton value="hello" aria-label="Copy share link" label="Copy" />);
      const button = screen.getByRole('button', { name: 'Copy share link' });

      await clickAndSettle(button);

      expect(button).toHaveAttribute('aria-label', 'Copy share link');
    });

    it('announces the copied label via a polite live region', async () => {
      const { container } = render(
        <CopyButton value="hello" aria-label="Copy value" copiedLabel="Link copied" />
      );
      const liveRegion = container.querySelector('[aria-live="polite"]');

      expect(liveRegion).toHaveTextContent('');
      await clickAndSettle(screen.getByRole('button', { name: 'Copy value' }));
      expect(liveRegion).toHaveTextContent('Link copied');

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(liveRegion).toHaveTextContent('');
    });
  });

  describe('fallback and failure', () => {
    it('falls back to execCommand when the clipboard API rejects', async () => {
      writeText.mockRejectedValue(new Error('not allowed'));
      const execCommand = vi.fn().mockReturnValue(true);
      document.execCommand = execCommand;
      const onCopied = vi.fn();
      render(<CopyButton value="hello" aria-label="Copy value" label="Copy" onCopied={onCopied} />);
      const button = screen.getByRole('button', { name: 'Copy value' });

      await clickAndSettle(button);

      expect(execCommand).toHaveBeenCalledWith('copy');
      expect(onCopied).toHaveBeenCalledTimes(1);
      expect(button).toHaveTextContent('Copied');
    });

    it('does not enter the copied state when copy fails entirely', async () => {
      writeText.mockRejectedValue(new Error('not allowed'));
      document.execCommand = vi.fn().mockReturnValue(false);
      const onCopied = vi.fn();
      render(<CopyButton value="hello" aria-label="Copy value" label="Copy" onCopied={onCopied} />);
      const button = screen.getByRole('button', { name: 'Copy value' });

      await clickAndSettle(button);

      expect(onCopied).not.toHaveBeenCalled();
      expect(button).toHaveTextContent('Copy');
      expect(button).not.toHaveTextContent('Copied');

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(button).toHaveTextContent('Copy');
      expect(button).not.toHaveTextContent('Copied');
    });
  });

  describe('rendering', () => {
    it('applies className', () => {
      render(<CopyButton value="hello" aria-label="Copy value" className="custom-class" />);
      expect(screen.getByRole('button', { name: 'Copy value' })).toHaveClass('custom-class');
    });

    it('renders icon-only when label is omitted', () => {
      render(<CopyButton value="hello" aria-label="Copy value" />);
      expect(screen.getByRole('button', { name: 'Copy value' }).className).toContain(
        'aspect-square'
      );
    });

    it('forwards ref to the button element', () => {
      const ref = createRef<HTMLButtonElement>();
      render(<CopyButton ref={ref} value="hello" aria-label="Copy value" />);
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });
  });
});
