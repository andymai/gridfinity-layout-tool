/**
 * ImageUploader component tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImageUploader } from './ImageUploader';
import { MAX_IMAGE_SIZE_BYTES } from '../../types';

// Mock File constructor for testing
function createMockFile(name: string, type: string, size: number = 1024): File {
  const file = new File([''], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('ImageUploader', () => {
  const mockOnImageSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders upload area', () => {
      render(<ImageUploader onImageSelect={mockOnImageSelect} />);

      expect(screen.getByText(/click or drag/i)).toBeInTheDocument();
    });

    it('shows file type hint', () => {
      render(<ImageUploader onImageSelect={mockOnImageSelect} />);

      expect(screen.getByText(/PNG, JPEG, or WebP/i)).toBeInTheDocument();
    });

    it('shows processing state', () => {
      render(<ImageUploader onImageSelect={mockOnImageSelect} isProcessing />);

      expect(screen.getByText(/Processing image/i)).toBeInTheDocument();
    });

    it('shows error message', () => {
      render(<ImageUploader onImageSelect={mockOnImageSelect} error="Failed to process" />);

      expect(screen.getByText('Failed to process')).toBeInTheDocument();
    });

    it('disables when disabled prop is true', () => {
      render(<ImageUploader onImageSelect={mockOnImageSelect} disabled />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('file selection', () => {
    it('accepts valid PNG file', async () => {
      render(<ImageUploader onImageSelect={mockOnImageSelect} />);

      const file = createMockFile('test.png', 'image/png');
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      expect(mockOnImageSelect).toHaveBeenCalledWith(file);
    });

    it('accepts valid JPEG file', async () => {
      render(<ImageUploader onImageSelect={mockOnImageSelect} />);

      const file = createMockFile('test.jpg', 'image/jpeg');
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      expect(mockOnImageSelect).toHaveBeenCalledWith(file);
    });

    it('accepts valid WebP file', async () => {
      render(<ImageUploader onImageSelect={mockOnImageSelect} />);

      const file = createMockFile('test.webp', 'image/webp');
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      expect(mockOnImageSelect).toHaveBeenCalledWith(file);
    });

    it('rejects invalid file type', async () => {
      render(<ImageUploader onImageSelect={mockOnImageSelect} />);

      const file = createMockFile('test.gif', 'image/gif');
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      expect(mockOnImageSelect).not.toHaveBeenCalled();
      expect(screen.getByText(/Please upload a PNG, JPEG, or WebP/i)).toBeInTheDocument();
    });

    it('rejects file that is too large', async () => {
      render(<ImageUploader onImageSelect={mockOnImageSelect} />);

      const file = createMockFile('test.png', 'image/png', MAX_IMAGE_SIZE_BYTES + 1);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      expect(mockOnImageSelect).not.toHaveBeenCalled();
      expect(screen.getByText(/must be smaller than/i)).toBeInTheDocument();
    });
  });

  describe('drag and drop', () => {
    it('shows drag state on dragover', () => {
      render(<ImageUploader onImageSelect={mockOnImageSelect} />);

      const dropZone = screen.getByRole('button');

      fireEvent.dragOver(dropZone);

      expect(screen.getByText(/Drop image here/i)).toBeInTheDocument();
    });

    it('accepts valid file on drop', () => {
      render(<ImageUploader onImageSelect={mockOnImageSelect} />);

      const file = createMockFile('test.png', 'image/png');
      const dropZone = screen.getByRole('button');

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file] },
      });

      expect(mockOnImageSelect).toHaveBeenCalledWith(file);
    });

    it('rejects invalid file on drop', () => {
      render(<ImageUploader onImageSelect={mockOnImageSelect} />);

      const file = createMockFile('test.gif', 'image/gif');
      const dropZone = screen.getByRole('button');

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file] },
      });

      expect(mockOnImageSelect).not.toHaveBeenCalled();
      expect(screen.getByText(/Please upload a PNG, JPEG, or WebP/i)).toBeInTheDocument();
    });
  });

  describe('click handling', () => {
    it('opens file dialog on click', () => {
      render(<ImageUploader onImageSelect={mockOnImageSelect} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(input, 'click');

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(clickSpy).toHaveBeenCalled();
    });

    it('does not open file dialog when disabled', () => {
      render(<ImageUploader onImageSelect={mockOnImageSelect} disabled />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(input, 'click');

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('does not open file dialog when processing', () => {
      render(<ImageUploader onImageSelect={mockOnImageSelect} isProcessing />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(input, 'click');

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(clickSpy).not.toHaveBeenCalled();
    });
  });
});
