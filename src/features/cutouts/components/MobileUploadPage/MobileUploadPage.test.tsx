/**
 * Tests for MobileUploadPage component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MobileUploadPage } from './MobileUploadPage';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Store original location
const originalLocation = window.location;

/**
 * Helper to mock window.location.search
 */
function mockLocationSearch(search: string) {
  // Delete and redefine to allow modification
  // @ts-expect-error TECH-DEBT: test utility requires delete
  delete window.location;
  window.location = { ...originalLocation, search } as Location;
}

describe('MobileUploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    // Restore original location
    window.location = originalLocation;
  });

  it('renders the upload page title', () => {
    mockLocationSearch('?session=test1234567890ab');
    render(<MobileUploadPage />);

    expect(screen.getByText('Upload Cutout Photo')).toBeInTheDocument();
  });

  it('renders upload button when session is valid', () => {
    mockLocationSearch('?session=test1234567890ab');
    render(<MobileUploadPage />);

    // Button visible text is "Take a photo", "Select a photo" is only in aria-label
    expect(screen.getByText('Take a photo')).toBeInTheDocument();
    expect(screen.getByLabelText('Select a photo')).toBeInTheDocument();
  });

  it('shows invalid session error when no session param', () => {
    mockLocationSearch('');
    render(<MobileUploadPage />);

    expect(screen.getByText('Invalid or expired session')).toBeInTheDocument();
  });

  it('shows invalid session error for missing session value', () => {
    mockLocationSearch('?session=');
    render(<MobileUploadPage />);

    expect(screen.getByText('Invalid or expired session')).toBeInTheDocument();
  });

  it('renders file input for photo selection', () => {
    mockLocationSearch('?session=test1234567890ab');
    render(<MobileUploadPage />);

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
  });
});
