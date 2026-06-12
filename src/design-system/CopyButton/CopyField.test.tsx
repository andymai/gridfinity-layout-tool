import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CopyField } from './CopyField';

const writeText = vi.fn<(text: string) => Promise<void>>();

const defaultProps = {
  value: 'https://example.com/share/abc123',
  'aria-label': 'Share link',
  copyAriaLabel: 'Copy share link',
};

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
});

describe('CopyField', () => {
  it('renders a read-only input with the value', () => {
    render(<CopyField {...defaultProps} />);
    const input = screen.getByRole('textbox', { name: 'Share link' });

    expect(input).toHaveValue(defaultProps.value);
    expect(input).toHaveAttribute('readonly');
  });

  it('selects the full value when the input is clicked', () => {
    render(<CopyField {...defaultProps} />);
    const input = screen.getByRole('textbox', { name: 'Share link' });

    fireEvent.click(input);

    expect(input).toHaveProperty('selectionStart', 0);
    expect(input).toHaveProperty('selectionEnd', defaultProps.value.length);
  });

  it('copies the value via the copy button', async () => {
    render(<CopyField {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy share link' }));
    });

    expect(writeText).toHaveBeenCalledWith(defaultProps.value);
  });

  it('calls onCopied after a successful copy', async () => {
    const onCopied = vi.fn();
    render(<CopyField {...defaultProps} onCopied={onCopied} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy share link' }));
    });

    expect(onCopied).toHaveBeenCalledTimes(1);
  });

  it('announces a custom copiedLabel', async () => {
    const { container } = render(<CopyField {...defaultProps} copiedLabel="Link copied" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy share link' }));
    });

    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent('Link copied');
  });

  it('renders monospace by default', () => {
    render(<CopyField {...defaultProps} />);
    expect(screen.getByRole('textbox', { name: 'Share link' })).toHaveClass('font-mono');
  });

  it('renders proportional text when mono is false', () => {
    render(<CopyField {...defaultProps} mono={false} />);
    expect(screen.getByRole('textbox', { name: 'Share link' })).not.toHaveClass('font-mono');
  });
});
