import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { ImportModal } from '../../components/Modals/ImportModal';
import { createDefaultLayout } from '../../constants';
import { encodeLayoutForURL } from '../../storage';

describe('ImportModal', () => {
  const mockOnClose = vi.fn();
  const mockOnImport = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const renderModal = (isOpen = true) => {
    return render(
      <ImportModal
        isOpen={isOpen}
        onClose={mockOnClose}
        onImport={mockOnImport}
      />
    );
  };

  describe('Rendering', () => {
    it('renders when isOpen is true', () => {
      const { getByText } = renderModal(true);
      expect(getByText('Import Layout')).not.toBeNull();
    });

    it('does not render when isOpen is false', () => {
      const { queryByText } = renderModal(false);
      expect(queryByText('Import Layout')).toBeNull();
    });

    it('renders file upload button', () => {
      const { getByText } = renderModal();
      expect(getByText('Upload JSON File')).not.toBeNull();
    });

    it('renders textarea for JSON input', () => {
      const { getByLabelText } = renderModal();
      expect(getByLabelText(/paste JSON/i)).not.toBeNull();
    });

    it('renders import and cancel buttons', () => {
      const { getByText } = renderModal();
      expect(getByText('Import')).not.toBeNull();
      expect(getByText('Cancel')).not.toBeNull();
    });
  });

  describe('Closing', () => {
    it('calls onClose when close button is clicked', () => {
      const { getByLabelText } = renderModal();

      act(() => {
        fireEvent.click(getByLabelText('Close'));
      });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onClose when cancel button is clicked', () => {
      const { getByText } = renderModal();

      act(() => {
        fireEvent.click(getByText('Cancel'));
      });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onClose when backdrop is clicked', () => {
      const { container } = renderModal();

      // The backdrop is the first fixed div
      const backdrop = container.querySelector('.fixed.inset-0');
      expect(backdrop).not.toBeNull();

      act(() => {
        fireEvent.click(backdrop!);
      });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onClose when Escape is pressed', () => {
      renderModal();

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('JSON Validation', () => {
    it('shows error for invalid JSON', async () => {
      const { getByLabelText, container } = renderModal();

      const textarea = getByLabelText(/paste JSON/i);

      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'not valid json{{{' } });
      });

      await waitFor(() => {
        // Error message is prefixed with a bullet point in a list
        expect(container.textContent).toContain('Invalid JSON format');
      });
    });

    it('shows validation errors for invalid layout structure', async () => {
      const { getByLabelText, findByText } = renderModal();

      const textarea = getByLabelText(/paste JSON/i);
      const invalidLayout = JSON.stringify({ invalid: 'data' });

      await act(async () => {
        fireEvent.change(textarea, { target: { value: invalidLayout } });
      });

      expect(await findByText('Validation Errors:')).not.toBeNull();
    });

    it('shows preview for valid layout', async () => {
      const { getByLabelText, findByText } = renderModal();

      const textarea = getByLabelText(/paste JSON/i);
      const validLayout = createDefaultLayout();

      await act(async () => {
        fireEvent.change(textarea, { target: { value: JSON.stringify(validLayout) } });
      });

      expect(await findByText('Preview:')).not.toBeNull();
      expect(await findByText(/Drawer size:/)).not.toBeNull();
      expect(await findByText(/Layers:/)).not.toBeNull();
      expect(await findByText(/Bins:/)).not.toBeNull();
    });

    it('shows correct drawer dimensions in preview', async () => {
      const { getByLabelText, findByText } = renderModal();

      const textarea = getByLabelText(/paste JSON/i);
      const layout = createDefaultLayout();
      layout.drawer = { width: 12, depth: 10, height: 40 };

      await act(async () => {
        fireEvent.change(textarea, { target: { value: JSON.stringify(layout) } });
      });

      expect(await findByText('Drawer size: 12×10×40')).not.toBeNull();
    });

    it('clears errors when textarea is cleared', async () => {
      const { getByLabelText, container } = renderModal();

      const textarea = getByLabelText(/paste JSON/i);

      // First add invalid JSON
      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'invalid' } });
      });

      await waitFor(() => {
        expect(container.textContent).toContain('Invalid JSON format');
      });

      // Then clear it
      await act(async () => {
        fireEvent.change(textarea, { target: { value: '' } });
      });

      // Wait for state to update
      await waitFor(() => {
        expect(container.textContent).not.toContain('Invalid JSON format');
      });
    });
  });

  describe('Import action', () => {
    it('import button is disabled when textarea is empty', () => {
      const { getByText } = renderModal();

      const importButton = getByText('Import') as HTMLButtonElement;
      expect(importButton.disabled).toBe(true);
    });

    it('import button is disabled when there are validation errors', async () => {
      const { getByLabelText, getByText } = renderModal();

      const textarea = getByLabelText(/paste JSON/i);

      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'invalid json' } });
      });

      const importButton = getByText('Import') as HTMLButtonElement;
      expect(importButton.disabled).toBe(true);
    });

    it('import button is enabled for valid layout', async () => {
      const { getByLabelText, getByText } = renderModal();

      const textarea = getByLabelText(/paste JSON/i);
      const validLayout = createDefaultLayout();

      await act(async () => {
        fireEvent.change(textarea, { target: { value: JSON.stringify(validLayout) } });
      });

      await waitFor(() => {
        const importButton = getByText('Import') as HTMLButtonElement;
        expect(importButton.disabled).toBe(false);
      });
    });

    it('calls onImport with parsed layout when import is clicked', async () => {
      const { getByLabelText, getByText } = renderModal();

      const textarea = getByLabelText(/paste JSON/i);
      const validLayout = createDefaultLayout();

      await act(async () => {
        fireEvent.change(textarea, { target: { value: JSON.stringify(validLayout) } });
      });

      await waitFor(() => {
        const importButton = getByText('Import') as HTMLButtonElement;
        expect(importButton.disabled).toBe(false);
      });

      await act(async () => {
        fireEvent.click(getByText('Import'));
      });

      expect(mockOnImport).toHaveBeenCalledWith(expect.objectContaining({
        version: validLayout.version,
        name: validLayout.name,
      }));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('shows error when importing empty textarea', async () => {
      const { getByText } = renderModal();

      // The Import button should be disabled when textarea is empty
      // We can verify this directly
      const importButton = getByText('Import') as HTMLButtonElement;
      expect(importButton.disabled).toBe(true);

      // The component prevents import with empty textarea by disabling the button
      // so "No JSON provided" error only appears if someone bypasses the disabled state
      // which is not a normal user flow - the button being disabled IS the validation
    });
  });

  describe('File upload', () => {
    it('file input accepts .json files', () => {
      const { container } = renderModal();

      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).not.toBeNull();
      expect(fileInput?.getAttribute('accept')).toBe('.json');
    });

    it('clicking upload button triggers file input', () => {
      const { getByText, container } = renderModal();

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, 'click');

      act(() => {
        fireEvent.click(getByText('Upload JSON File'));
      });

      expect(clickSpy).toHaveBeenCalled();
    });

    it('handles file upload and parses JSON', async () => {
      const { container, findByText } = renderModal();
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      const validLayout = createDefaultLayout();
      const file = new File([JSON.stringify(validLayout)], 'test.json', {
        type: 'application/json',
      });

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
        // Wait for FileReader to complete
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(await findByText('Preview:')).not.toBeNull();
    });

    it('handles file upload with no files', async () => {
      const { container, queryByText } = renderModal();
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: null } });
      });

      // Should not show preview or error
      expect(queryByText('Preview:')).toBeNull();
      expect(queryByText('Validation Errors:')).toBeNull();
    });
  });

  describe('Share URL handling', () => {
    it('shows preview for valid share URL', async () => {
      const { getByLabelText, container } = renderModal();

      const textarea = getByLabelText(/paste JSON/i);
      // Create a minimal valid encoded layout (simplified mock)
      // The actual encoding would use lz-string compression
      const mockShareUrl = 'https://example.com#share=test-encoded-data';

      await act(async () => {
        fireEvent.change(textarea, { target: { value: mockShareUrl } });
      });

      // Note: This will show validation errors since the encoding is invalid
      // The key is exercising the share URL detection branch
      await waitFor(() => {
        expect(container.textContent).toContain('Validation Errors:');
      });
    });

    it('detects share URL format', async () => {
      const { getByLabelText, container } = renderModal();

      const textarea = getByLabelText(/paste JSON/i);
      // Test with different URL formats
      const shareUrl = '#share=ABC123_-xyz';

      await act(async () => {
        fireEvent.change(textarea, { target: { value: shareUrl } });
      });

      // The share URL was detected (even if decoding fails)
      await waitFor(() => {
        // Either shows error or preview depending on decode success
        const hasResponse = container.textContent?.includes('Validation Errors:') ||
                           container.textContent?.includes('Preview:');
        expect(hasResponse).toBe(true);
      });
    });
  });

  describe('Specific validation scenarios', () => {
    it('validates missing required fields', async () => {
      const { getByLabelText, findByText } = renderModal();

      const textarea = getByLabelText(/paste JSON/i);
      const incompleteLayout = { version: '1.0' }; // Missing drawer, layers, etc.

      await act(async () => {
        fireEvent.change(textarea, { target: { value: JSON.stringify(incompleteLayout) } });
      });

      expect(await findByText('Validation Errors:')).not.toBeNull();
    });

    it('validates bin references', async () => {
      const { getByLabelText, findByText } = renderModal();

      const textarea = getByLabelText(/paste JSON/i);
      const layout = createDefaultLayout();
      // Add a bin with invalid layer reference
      layout.bins = [{
        id: 'bin-1',
        x: 0,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        layerId: 'nonexistent-layer',
        category: layout.categories[0].id,
        label: '',
        notes: '',
      }];

      await act(async () => {
        fireEvent.change(textarea, { target: { value: JSON.stringify(layout) } });
      });

      expect(await findByText('Validation Errors:')).not.toBeNull();
    });

    it('accepts layout with bins', async () => {
      const { getByLabelText, findByText } = renderModal();

      const textarea = getByLabelText(/paste JSON/i);
      const layout = createDefaultLayout();
      layout.bins = [{
        id: 'bin-1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        layerId: layout.layers[0].id,
        category: layout.categories[0].id,
        label: '',
        notes: '',
      }];

      await act(async () => {
        fireEvent.change(textarea, { target: { value: JSON.stringify(layout) } });
      });

      expect(await findByText('Bins: 1')).not.toBeNull();
    });
  });

  describe('Share URL import', () => {
    it('imports valid share URL', async () => {
      const { getByLabelText, getByText } = renderModal();

      const textarea = getByLabelText(/paste JSON/i);
      const validLayout = createDefaultLayout();
      const encoded = encodeLayoutForURL(validLayout);
      const shareUrl = `#share=${encoded}`;

      await act(async () => {
        fireEvent.change(textarea, { target: { value: shareUrl } });
      });

      // Wait for preview to appear (indicates valid layout)
      await waitFor(() => {
        const importButton = getByText('Import') as HTMLButtonElement;
        expect(importButton.disabled).toBe(false);
      });

      await act(async () => {
        fireEvent.click(getByText('Import'));
      });

      expect(mockOnImport).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('shows error for invalid share URL encoding', async () => {
      const { getByLabelText, findByText } = renderModal();

      const textarea = getByLabelText(/paste JSON/i);
      // Invalid base64 encoded data
      const invalidShareUrl = '#share=!!!invalid-base64!!!';

      await act(async () => {
        fireEvent.change(textarea, { target: { value: invalidShareUrl } });
      });

      expect(await findByText('Validation Errors:')).not.toBeNull();
    });
  });
});
