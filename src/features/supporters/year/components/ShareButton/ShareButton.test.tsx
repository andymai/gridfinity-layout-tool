import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ShareButton } from './ShareButton';

const download = vi.fn();
vi.mock('@/shared/generation/exportUtils', () => ({
  triggerDownload: (...args: unknown[]) => download(...args),
}));

const blob = new Blob(['png'], { type: 'image/png' });

describe('ShareButton', () => {
  afterEach(() => {
    download.mockClear();
    Reflect.deleteProperty(navigator, 'canShare');
    Reflect.deleteProperty(navigator, 'share');
  });

  it('waits for the image', () => {
    render(<ShareButton blob={null} fileName="your-2026-bins.png" />);
    expect(screen.getByRole('button', { name: 'Save image' })).toBeDisabled();
  });

  it('downloads the image where the browser cannot share a file', () => {
    render(<ShareButton blob={blob} fileName="your-2026-bins.png" />);
    fireEvent.click(screen.getByRole('button', { name: 'Save image' }));
    expect(download).toHaveBeenCalledWith(blob, 'your-2026-bins.png');
  });

  it('opens the share sheet where it can', () => {
    const share = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    render(<ShareButton blob={blob} fileName="your-2026-bins.png" />);
    fireEvent.click(screen.getByRole('button', { name: 'Save image' }));
    expect(share).toHaveBeenCalledTimes(1);
    expect(download).not.toHaveBeenCalled();
  });
});
