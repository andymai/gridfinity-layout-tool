import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ImportView } from '../../components/Modals/LayoutManagerModal/ImportView';
import * as validation from '../../shared/utils/validation';
import * as storage from '../../core/storage';

// Mock the modules
vi.mock('../../shared/utils/validation', () => ({
  validateImport: vi.fn(() => ({ valid: true, errors: [] })),
}));

vi.mock('../../core/storage', () => ({
  decodeLayoutFromURL: vi.fn(() => ({ layout: null, errors: [] })),
}));

describe('ImportView', () => {
  const mockOnImport = vi.fn();
  const mockOnCancel = vi.fn();

  const validLayout = {
    version: '1.0',
    name: 'Test Layout',
    drawer: { width: 10, depth: 8, height: 12 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories: [{ id: 'coral', name: 'Coral', color: '#FF6B6B' }],
    layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
    bins: [
      { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'coral', label: '', notes: '' },
      { id: 'bin2', layerId: 'layer1', x: 2, y: 0, width: 2, depth: 2, height: 3, category: 'coral', label: '', notes: '' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validation.validateImport).mockReturnValue({ valid: true, errors: [] });
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders drop zone', () => {
      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      expect(screen.getByText('Drag and drop a JSON file here')).toBeInTheDocument();
    });

    it('renders Browse Files button', () => {
      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      expect(screen.getByText('Browse Files')).toBeInTheDocument();
    });

    it('renders JSON textarea', () => {
      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      expect(screen.getByLabelText('Layout JSON')).toBeInTheDocument();
    });

    it('renders Import button (disabled initially)', () => {
      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      const importButton = screen.getByText('Import Layout');
      expect(importButton).toBeInTheDocument();
      expect(importButton).toBeDisabled();
    });

    it('renders Cancel button', () => {
      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('JSON text input', () => {
    it('accepts text input', () => {
      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      const textarea = screen.getByLabelText('Layout JSON');
      fireEvent.change(textarea, { target: { value: '{"test": true}' } });

      expect(textarea).toHaveValue('{"test": true}');
    });

    it('shows preview for valid JSON', () => {
      vi.mocked(validation.validateImport).mockReturnValue({ valid: true, errors: [] });

      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      const textarea = screen.getByLabelText('Layout JSON');
      fireEvent.change(textarea, { target: { value: JSON.stringify(validLayout) } });

      expect(screen.getByText('Ready to Import')).toBeInTheDocument();
      expect(screen.getByText('Test Layout')).toBeInTheDocument();
      expect(screen.getByText('10×8×12')).toBeInTheDocument();
    });

    it('shows error for invalid JSON syntax', () => {
      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      const textarea = screen.getByLabelText('Layout JSON');
      fireEvent.change(textarea, { target: { value: '{invalid json}' } });

      expect(screen.getByText('Validation Errors')).toBeInTheDocument();
      expect(screen.getByText('• Invalid JSON format')).toBeInTheDocument();
    });

    it('shows validation errors for invalid layout', () => {
      vi.mocked(validation.validateImport).mockReturnValue({
        valid: false,
        errors: ['Missing drawer property', 'Invalid bins array'],
      });

      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      const textarea = screen.getByLabelText('Layout JSON');
      fireEvent.change(textarea, { target: { value: '{"version": "1.0"}' } });

      expect(screen.getByText('Validation Errors')).toBeInTheDocument();
      expect(screen.getByText('• Missing drawer property')).toBeInTheDocument();
      expect(screen.getByText('• Invalid bins array')).toBeInTheDocument();
    });

    it('enables Import button when valid', () => {
      vi.mocked(validation.validateImport).mockReturnValue({ valid: true, errors: [] });

      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      const textarea = screen.getByLabelText('Layout JSON');
      fireEvent.change(textarea, { target: { value: JSON.stringify(validLayout) } });

      const importButton = screen.getByText('Import Layout');
      expect(importButton).not.toBeDisabled();
    });

    it('shows Clear button when text is present', () => {
      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      const textarea = screen.getByLabelText('Layout JSON');
      fireEvent.change(textarea, { target: { value: 'some text' } });

      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    it('clears text when Clear button clicked', () => {
      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      const textarea = screen.getByLabelText('Layout JSON');
      fireEvent.change(textarea, { target: { value: 'some text' } });
      fireEvent.click(screen.getByText('Clear'));

      expect(textarea).toHaveValue('');
    });
  });

  describe('share URL parsing', () => {
    it('parses share URL format', () => {
      vi.mocked(storage.decodeLayoutFromURL).mockReturnValue({ layout: validLayout, errors: [] });

      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      const textarea = screen.getByLabelText('Layout JSON');
      fireEvent.change(textarea, { target: { value: 'https://example.com/#share=abc123XYZ' } });

      expect(storage.decodeLayoutFromURL).toHaveBeenCalledWith('abc123XYZ');
    });

    it('shows preview for valid share URL', () => {
      vi.mocked(storage.decodeLayoutFromURL).mockReturnValue({ layout: validLayout, errors: [] });

      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      const textarea = screen.getByLabelText('Layout JSON');
      fireEvent.change(textarea, { target: { value: '#share=abc123' } });

      expect(screen.getByText('Ready to Import')).toBeInTheDocument();
    });

    it('shows errors for invalid share URL', () => {
      vi.mocked(storage.decodeLayoutFromURL).mockReturnValue({
        layout: null,
        errors: ['Invalid share URL', 'Could not decode layout'],
      });

      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      const textarea = screen.getByLabelText('Layout JSON');
      fireEvent.change(textarea, { target: { value: '#share=invalid' } });

      expect(screen.getByText('Validation Errors')).toBeInTheDocument();
      expect(screen.getByText('• Invalid share URL')).toBeInTheDocument();
    });
  });

  describe('file upload', () => {
    it('triggers file input when Browse Files clicked', () => {
      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, 'click');

      fireEvent.click(screen.getByText('Browse Files'));

      expect(clickSpy).toHaveBeenCalled();
    });

    it('processes uploaded JSON file', async () => {
      vi.mocked(validation.validateImport).mockReturnValue({ valid: true, errors: [] });

      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File([JSON.stringify(validLayout)], 'layout.json', { type: 'application/json' });

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        configurable: true,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText('Ready to Import')).toBeInTheDocument();
      });
    });
  });

  describe('drag and drop', () => {
    it('shows drag state when dragging over', () => {
      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      const dropZone = screen.getByText('Drag and drop a JSON file here').closest('div');
      fireEvent.dragOver(dropZone!, { preventDefault: vi.fn(), stopPropagation: vi.fn() });

      expect(screen.getByText('Drop your file here')).toBeInTheDocument();
    });

    it('removes drag state when drag leaves', () => {
      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      const dropZone = screen.getByText('Drag and drop a JSON file here').closest('div');
      fireEvent.dragOver(dropZone!, { preventDefault: vi.fn(), stopPropagation: vi.fn() });
      fireEvent.dragLeave(dropZone!, { preventDefault: vi.fn(), stopPropagation: vi.fn() });

      expect(screen.getByText('Drag and drop a JSON file here')).toBeInTheDocument();
    });

    it('processes dropped JSON file', async () => {
      vi.mocked(validation.validateImport).mockReturnValue({ valid: true, errors: [] });

      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      const dropZone = screen.getByText('Drag and drop a JSON file here').closest('div');
      const file = new File([JSON.stringify(validLayout)], 'layout.json', { type: 'application/json' });

      const dataTransfer = {
        files: [file],
      };

      fireEvent.drop(dropZone!, {
        dataTransfer,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      });

      await waitFor(() => {
        expect(screen.getByText('Ready to Import')).toBeInTheDocument();
      });
    });

    it('shows error for non-JSON file drop', () => {
      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      const dropZone = screen.getByText('Drag and drop a JSON file here').closest('div');
      const file = new File(['some content'], 'layout.txt', { type: 'text/plain' });

      const dataTransfer = {
        files: [file],
      };

      fireEvent.drop(dropZone!, {
        dataTransfer,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      });

      expect(screen.getByText('• Please drop a JSON file')).toBeInTheDocument();
    });

    it('handles empty file drop', () => {
      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      const dropZone = screen.getByText('Drag and drop a JSON file here').closest('div');

      const dataTransfer = {
        files: [],
      };

      fireEvent.drop(dropZone!, {
        dataTransfer,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      });

      // Should not show any errors for empty drop
      expect(screen.queryByText('Validation Errors')).not.toBeInTheDocument();
    });
  });

  describe('import action', () => {
    it('calls onImport with valid layout when Import clicked', () => {
      vi.mocked(validation.validateImport).mockReturnValue({ valid: true, errors: [] });

      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      const textarea = screen.getByLabelText('Layout JSON');
      fireEvent.change(textarea, { target: { value: JSON.stringify(validLayout) } });

      fireEvent.click(screen.getByText('Import Layout'));

      expect(mockOnImport).toHaveBeenCalledWith(validLayout);
    });

    it('does not call onImport when no valid layout', () => {
      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      fireEvent.click(screen.getByText('Import Layout'));

      expect(mockOnImport).not.toHaveBeenCalled();
    });
  });

  describe('cancel action', () => {
    it('calls onCancel when Cancel clicked', () => {
      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      fireEvent.click(screen.getByText('Cancel'));

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('preview display', () => {
    it('shows layer count', () => {
      vi.mocked(validation.validateImport).mockReturnValue({ valid: true, errors: [] });

      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      const textarea = screen.getByLabelText('Layout JSON');
      fireEvent.change(textarea, { target: { value: JSON.stringify(validLayout) } });

      expect(screen.getByText('Layers:')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('shows bin count', () => {
      vi.mocked(validation.validateImport).mockReturnValue({ valid: true, errors: [] });

      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      const textarea = screen.getByLabelText('Layout JSON');
      fireEvent.change(textarea, { target: { value: JSON.stringify(validLayout) } });

      expect(screen.getByText('Bins:')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('empty input handling', () => {
    it('does not process empty input', () => {
      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      const textarea = screen.getByLabelText('Layout JSON');
      fireEvent.change(textarea, { target: { value: '' } });

      expect(screen.queryByText('Validation Errors')).not.toBeInTheDocument();
      expect(screen.queryByText('Ready to Import')).not.toBeInTheDocument();
    });

    it('does not process whitespace-only input', () => {
      render(<ImportView onImport={mockOnImport} onCancel={mockOnCancel} />);

      const textarea = screen.getByLabelText('Layout JSON');
      fireEvent.change(textarea, { target: { value: '   \n\t  ' } });

      expect(screen.queryByText('Validation Errors')).not.toBeInTheDocument();
      expect(screen.queryByText('Ready to Import')).not.toBeInTheDocument();
    });
  });
});
