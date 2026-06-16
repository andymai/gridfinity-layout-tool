import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScanQrCode } from './ScanQrCode';

vi.mock('qrcode', () => ({
  toDataURL: () => Promise.resolve('data:image/png;base64,QQ=='),
}));

describe('ScanQrCode', () => {
  it('renders the generated QR image with the given alt text', async () => {
    render(<ScanQrCode url="https://example.com/scan/abc" alt="scan qr" />);
    const img = await screen.findByAltText('scan qr');
    expect(img).toHaveAttribute('src', 'data:image/png;base64,QQ==');
  });

  it('renders the container immediately while the code generates', () => {
    const { container } = render(<ScanQrCode url="https://example.com/scan/abc" alt="scan qr" />);
    expect(container.querySelector('div')).not.toBeNull();
  });
});
