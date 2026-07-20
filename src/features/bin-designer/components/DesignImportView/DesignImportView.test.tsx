import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DesignImportView } from './DesignImportView';
import { exportDesignJSON } from '../../utils/designJson';
import { DEFAULT_BIN_PARAMS } from '../../constants/defaults';

// Mock FileReader for file drop tests
class MockFileReader {
  result: string | null = null;
  onload: ((e: ProgressEvent<FileReader>) => void) | null = null;
  readAsText(_file: File) {
    if (this.onload && this.result !== null) {
      this.onload({ target: { result: this.result } } as ProgressEvent<FileReader>);
    }
  }
}

describe('DesignImportView', () => {
  const defaultProps = {
    onImport: vi.fn(),
    onCancel: vi.fn(),
  };

  let originalFileReader: typeof FileReader;

  beforeEach(() => {
    vi.clearAllMocks();
    // Save original FileReader
    originalFileReader = globalThis.FileReader;
  });

  afterEach(() => {
    // Restore original FileReader
    globalThis.FileReader = originalFileReader;
  });

  it('renders drop zone and textarea', () => {
    render(<DesignImportView {...defaultProps} />);

    // Check for browse files button
    expect(screen.getByText('Browse files')).toBeInTheDocument();

    // Check for textarea
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute('placeholder', 'or paste design JSON');
  });

  it('Import & Load button is disabled when no valid design', () => {
    render(<DesignImportView {...defaultProps} />);

    const importButton = screen.getByText('Import & Load');
    expect(importButton).toBeDisabled();
  });

  it('Cancel button calls onCancel', () => {
    render(<DesignImportView {...defaultProps} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(defaultProps.onCancel).toHaveBeenCalledOnce();
  });

  it('validates pasted JSON and shows preview', () => {
    const validJSON = exportDesignJSON('Test Bin', DEFAULT_BIN_PARAMS);

    render(<DesignImportView {...defaultProps} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: validJSON } });

    // Check preview shows
    expect(screen.getByText('Ready to import design')).toBeInTheDocument();
    expect(screen.getByText('Test Bin')).toBeInTheDocument();

    // Check dimensions - DEFAULT_BIN_PARAMS is 2×2×3
    expect(screen.getByText('2×2×3')).toBeInTheDocument();

    // Check compartment count - DEFAULT_BIN_PARAMS has 1 compartment (cells: [0])
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows validation errors for invalid JSON', () => {
    render(<DesignImportView {...defaultProps} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'invalid json' } });

    // Check error message appears
    expect(screen.getByText('Validation errors')).toBeInTheDocument();
    // Use getAllByText since "Invalid JSON" appears in both textarea and error list
    const errorTexts = screen.getAllByText(/Invalid JSON/i);
    expect(errorTexts.length).toBeGreaterThan(0);
  });

  it('shows validation errors for wrong type field', () => {
    const wrongTypeJSON = JSON.stringify({
      type: 'wrong-type',
      version: '1.0',
      name: 'Test',
      params: DEFAULT_BIN_PARAMS,
    });

    render(<DesignImportView {...defaultProps} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: wrongTypeJSON } });

    // Check error message appears
    expect(screen.getByText('Validation errors')).toBeInTheDocument();
    expect(screen.getByText(/Invalid design type/i)).toBeInTheDocument();
  });

  it('enables Import & Load button when valid design is parsed', () => {
    const validJSON = exportDesignJSON('Test Bin', DEFAULT_BIN_PARAMS);

    render(<DesignImportView {...defaultProps} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: validJSON } });

    const importButton = screen.getByText('Import & Load');
    expect(importButton).not.toBeDisabled();
  });

  it('calls onImport with parsed design on Import & Load click', () => {
    const validJSON = exportDesignJSON('Test Bin', DEFAULT_BIN_PARAMS);

    render(<DesignImportView {...defaultProps} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: validJSON } });

    const importButton = screen.getByText('Import & Load');
    fireEvent.click(importButton);

    expect(defaultProps.onImport).toHaveBeenCalledOnce();
    expect(defaultProps.onImport).toHaveBeenCalledWith({
      name: 'Test Bin',
      params: expect.objectContaining({
        width: DEFAULT_BIN_PARAMS.width,
        depth: DEFAULT_BIN_PARAMS.depth,
        height: DEFAULT_BIN_PARAMS.height,
      }),
    });
  });

  it('clears state when Clear button is clicked', () => {
    const validJSON = exportDesignJSON('Test Bin', DEFAULT_BIN_PARAMS);

    render(<DesignImportView {...defaultProps} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: validJSON } });

    // Verify preview is shown
    expect(screen.getByText('Ready to import design')).toBeInTheDocument();

    // Click Clear button
    const clearButton = screen.getByText('Clear');
    fireEvent.click(clearButton);

    // Verify preview is gone
    expect(screen.queryByText('Ready to import design')).not.toBeInTheDocument();

    // Verify textarea is empty
    expect(textarea.value).toBe('');
  });

  it('processes dropped JSON file', async () => {
    const validJSON = exportDesignJSON('Dropped Bin', DEFAULT_BIN_PARAMS);

    // Mock FileReader - need to use function syntax for constructor
    globalThis.FileReader = function FileReaderMock(this: MockFileReader) {
      this.result = validJSON;
      this.onload = null;
    } as unknown as typeof FileReader;
    globalThis.FileReader.prototype.readAsText = MockFileReader.prototype.readAsText;

    render(<DesignImportView {...defaultProps} />);

    // Create a mock JSON file
    const file = new File([validJSON], 'test-design.json', { type: 'application/json' });

    // Get the drop zone (the div with border-dashed)
    const dropZone = screen.getByText('Drag & drop a design JSON file here').closest('div');
    expect(dropZone).toBeTruthy();

    // Simulate file drop
    const dataTransfer = {
      files: [file],
      types: ['Files'],
    };

    fireEvent.dragOver(dropZone!, { dataTransfer });
    fireEvent.drop(dropZone!, { dataTransfer });

    // Wait for FileReader to process
    await waitFor(() => {
      expect(screen.getByText('Ready to import design')).toBeInTheDocument();
    });

    // Verify preview shows correct name
    expect(screen.getByText('Dropped Bin')).toBeInTheDocument();
  });

  it('rejects non-JSON file on drop', () => {
    render(<DesignImportView {...defaultProps} />);

    // Create a mock text file
    const file = new File(['some text'], 'test.txt', { type: 'text/plain' });

    // Get the drop zone
    const dropZone = screen.getByText('Drag & drop a design JSON file here').closest('div');
    expect(dropZone).toBeTruthy();

    // Simulate file drop
    const dataTransfer = {
      files: [file],
      types: ['Files'],
    };

    fireEvent.drop(dropZone!, { dataTransfer });

    // Check error message appears
    expect(screen.getByText('Validation errors')).toBeInTheDocument();
    expect(screen.getByText('• Please drop a JSON file')).toBeInTheDocument();
  });

  it('shows drag styling on drag over', () => {
    render(<DesignImportView {...defaultProps} />);

    const dropZone = screen.getByText('Drag & drop a design JSON file here').closest('div');
    expect(dropZone).toBeTruthy();

    // Simulate drag over
    fireEvent.dragOver(dropZone!);

    // Check for drag styling (text changes)
    expect(screen.getByText('Drop file here')).toBeInTheDocument();

    // Simulate drag leave
    fireEvent.dragLeave(dropZone!);

    // Text should revert
    expect(screen.getByText('Drag & drop a design JSON file here')).toBeInTheDocument();
  });

  it('triggers file input when Browse files button is clicked', () => {
    render(<DesignImportView {...defaultProps} />);

    const browseButton = screen.getByText('Browse files');

    // Mock the hidden file input click
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const clickSpy = vi.spyOn(fileInput, 'click');

    fireEvent.click(browseButton);

    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('processes file from file input', async () => {
    const validJSON = exportDesignJSON('Uploaded Bin', DEFAULT_BIN_PARAMS);

    // Mock FileReader - need to use function syntax for constructor
    globalThis.FileReader = function FileReaderMock(this: MockFileReader) {
      this.result = validJSON;
      this.onload = null;
    } as unknown as typeof FileReader;
    globalThis.FileReader.prototype.readAsText = MockFileReader.prototype.readAsText;

    render(<DesignImportView {...defaultProps} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    // Create a mock JSON file
    const file = new File([validJSON], 'test-design.json', { type: 'application/json' });

    // Simulate file selection
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(fileInput);

    // Wait for FileReader to process
    await waitFor(() => {
      expect(screen.getByText('Ready to import design')).toBeInTheDocument();
    });

    // Verify preview shows correct name
    expect(screen.getByText('Uploaded Bin')).toBeInTheDocument();
  });

  it('shows multiple compartments in preview', () => {
    // Create params with multiple compartments
    const multiCompartmentParams = {
      ...DEFAULT_BIN_PARAMS,
      compartments: {
        cols: 2,
        rows: 2,
        thickness: 1.2,
        cells: [0, 0, 1, 2], // 2 compartments (cell 0 appears twice, cells 1 and 2 once each)
      },
    };

    const validJSON = exportDesignJSON('Multi-Compartment Bin', multiCompartmentParams);

    render(<DesignImportView {...defaultProps} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: validJSON } });

    // Check preview shows correct compartment count (unique IDs: 0, 1, 2 = 3 compartments)
    expect(screen.getByText('Ready to import design')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('handles empty file drop gracefully', () => {
    render(<DesignImportView {...defaultProps} />);

    const dropZone = screen.getByText('Drag & drop a design JSON file here').closest('div');
    expect(dropZone).toBeTruthy();

    // Simulate drop with no files
    const dataTransfer = {
      files: [],
      types: ['Files'],
    };

    fireEvent.drop(dropZone!, { dataTransfer });

    // Should not show any errors or preview
    expect(screen.queryByText('Validation errors')).not.toBeInTheDocument();
    expect(screen.queryByText('Ready to import design')).not.toBeInTheDocument();
  });

  it('handles missing params fields with validation errors', () => {
    const invalidJSON = JSON.stringify({
      type: 'gridfinity-bin-design',
      version: '1.0',
      name: 'Incomplete Bin',
      params: {
        width: 2,
        // Missing required fields
      },
    });

    render(<DesignImportView {...defaultProps} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: invalidJSON } });

    // Check error messages appear
    expect(screen.getByText('Validation errors')).toBeInTheDocument();
  });

  describe('STL routing (stl_bin_import)', () => {
    function stlFile(name = 'bin.stl'): File {
      return new File([new Uint8Array(100)], name, { type: 'model/stl' });
    }

    function dropFile(container: HTMLElement, file: File): void {
      const dropZone = container.querySelector('[class*="border-dashed"]') as HTMLElement;
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });
    }

    it('routes a dropped .stl to onStlFile when provided', () => {
      const onStlFile = vi.fn();
      const { container } = render(<DesignImportView {...defaultProps} onStlFile={onStlFile} />);
      dropFile(container, stlFile());
      expect(onStlFile).toHaveBeenCalledTimes(1);
      expect(onStlFile.mock.calls[0][0].name).toBe('bin.stl');
      expect(defaultProps.onImport).not.toHaveBeenCalled();
    });

    it('routes an .stl picked via the file input to onStlFile', () => {
      const onStlFile = vi.fn();
      const { container } = render(<DesignImportView {...defaultProps} onStlFile={onStlFile} />);
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input.accept).toBe('.json,.stl');
      fireEvent.change(input, { target: { files: [stlFile('picked.stl')] } });
      expect(onStlFile).toHaveBeenCalledTimes(1);
      expect(onStlFile.mock.calls[0][0].name).toBe('picked.stl');
    });

    it('matches .STL case-insensitively', () => {
      const onStlFile = vi.fn();
      const { container } = render(<DesignImportView {...defaultProps} onStlFile={onStlFile} />);
      dropFile(container, stlFile('UPPER.STL'));
      expect(onStlFile).toHaveBeenCalledTimes(1);
    });

    it('rejects a dropped .stl when onStlFile is absent (flag off)', () => {
      const { container } = render(<DesignImportView {...defaultProps} />);
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input.accept).toBe('.json');
      dropFile(container, stlFile());
      expect(screen.getByText('Validation errors')).toBeInTheDocument();
    });

    it('drop-zone text mentions STL only when onStlFile is provided', () => {
      const { unmount } = render(<DesignImportView {...defaultProps} onStlFile={vi.fn()} />);
      expect(screen.getByText(/JSON or STL file/)).toBeInTheDocument();
      unmount();
      render(<DesignImportView {...defaultProps} />);
      expect(screen.getByText(/design JSON file here/)).toBeInTheDocument();
      expect(screen.queryByText(/JSON or STL file/)).not.toBeInTheDocument();
    });
  });
});
