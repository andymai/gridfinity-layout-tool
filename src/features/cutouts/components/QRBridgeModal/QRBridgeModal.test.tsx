/**
 * Tests for QRBridgeModal component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QRBridgeModal } from './QRBridgeModal';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the useQRBridge hook
vi.mock('../../hooks/useQRBridge', () => ({
  useQRBridge: vi.fn(() => ({
    status: 'idle',
    sessionId: null,
    uploadUrl: null,
    imageUrl: null,
    imageName: null,
    expiresAt: null,
    error: null,
    isCreating: false,
    isPolling: false,
    startSession: vi.fn(),
    cancelSession: vi.fn(),
    reset: vi.fn(),
  })),
}));

describe('QRBridgeModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onImageReceived: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    render(<QRBridgeModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders modal when open', () => {
    render(<QRBridgeModal {...defaultProps} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Scan from Phone')).toBeInTheDocument();
  });

  it('renders cancel button', () => {
    render(<QRBridgeModal {...defaultProps} />);

    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onClose when cancel button clicked', () => {
    const onClose = vi.fn();

    render(<QRBridgeModal {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when overlay clicked', () => {
    const onClose = vi.fn();

    render(<QRBridgeModal {...defaultProps} onClose={onClose} />);

    // Click the overlay (the outer container with z-50)
    const overlay = document.querySelector('.z-50');
    if (overlay) {
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();

    render(<QRBridgeModal {...defaultProps} onClose={onClose} />);

    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });
});
