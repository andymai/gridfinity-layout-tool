import { describe, it, expect, vi, beforeEach } from 'vitest';
import { packagePiecesAsZip } from './zipExport';

// Mock JSZip
const mockFile = vi.fn();
const mockGenerateAsync = vi.fn().mockResolvedValue(new Blob(['zip-content']));

vi.mock('jszip', () => ({
  default: class MockJSZip {
    file = mockFile;
    generateAsync = mockGenerateAsync;
  },
}));

describe('packagePiecesAsZip', () => {
  beforeEach(() => {
    mockFile.mockClear();
    mockGenerateAsync.mockClear();
    mockGenerateAsync.mockResolvedValue(new Blob(['zip-content']));
  });

  it('creates a ZIP with one file per piece using the given extension', async () => {
    const pieces = [
      { data: new ArrayBuffer(100), label: 'piece-A1' },
      { data: new ArrayBuffer(200), label: 'piece-B2' },
    ];

    const blob = await packagePiecesAsZip(pieces, 'my-baseplate', '.stl');

    expect(blob).toBeInstanceOf(Blob);
    expect(mockFile).toHaveBeenCalledTimes(2);
    expect(mockFile).toHaveBeenCalledWith('my-baseplate_piece-A1.stl', pieces[0].data);
    expect(mockFile).toHaveBeenCalledWith('my-baseplate_piece-B2.stl', pieces[1].data);
  });

  it('uses DEFLATE compression', async () => {
    const pieces = [{ data: new ArrayBuffer(50), label: 'part-1' }];

    await packagePiecesAsZip(pieces, 'test', '.stl');

    expect(mockGenerateAsync).toHaveBeenCalledWith({
      type: 'blob',
      compression: 'DEFLATE',
    });
  });

  it('handles single piece', async () => {
    const pieces = [{ data: new ArrayBuffer(50), label: 'only-piece' }];

    await packagePiecesAsZip(pieces, 'solo', '.stl');

    expect(mockFile).toHaveBeenCalledTimes(1);
    expect(mockFile).toHaveBeenCalledWith('solo_only-piece.stl', pieces[0].data);
  });

  it('uses the provided extension parameter', async () => {
    const pieces = [{ data: new ArrayBuffer(100), label: 'part' }];

    await packagePiecesAsZip(pieces, 'base', '.step');

    expect(mockFile).toHaveBeenCalledWith('base_part.step', pieces[0].data);
  });

  it('handles multiple pieces with correct filenames', async () => {
    const pieces = [
      { data: new ArrayBuffer(10), label: 'A1' },
      { data: new ArrayBuffer(20), label: 'A2' },
      { data: new ArrayBuffer(30), label: 'B1' },
      { data: new ArrayBuffer(40), label: 'B2' },
    ];

    await packagePiecesAsZip(pieces, 'grid', '.stl');

    expect(mockFile).toHaveBeenCalledTimes(4);
    expect(mockFile).toHaveBeenCalledWith('grid_A1.stl', pieces[0].data);
    expect(mockFile).toHaveBeenCalledWith('grid_A2.stl', pieces[1].data);
    expect(mockFile).toHaveBeenCalledWith('grid_B1.stl', pieces[2].data);
    expect(mockFile).toHaveBeenCalledWith('grid_B2.stl', pieces[3].data);
  });

  it('includes extra text files in the ZIP when provided', async () => {
    const pieces = [{ data: new ArrayBuffer(10), label: 'corner' }];

    await packagePiecesAsZip(pieces, 'test', '.stl', [
      { name: 'print-guide.txt', content: 'Hello world' },
    ]);

    expect(mockFile).toHaveBeenCalledTimes(2);
    expect(mockFile).toHaveBeenCalledWith('test_corner.stl', pieces[0].data);
    expect(mockFile).toHaveBeenCalledWith('print-guide.txt', 'Hello world');
  });

  it('skips extra files when not provided', async () => {
    const pieces = [{ data: new ArrayBuffer(10), label: 'piece' }];

    await packagePiecesAsZip(pieces, 'test', '.stl');

    expect(mockFile).toHaveBeenCalledTimes(1);
  });

  it('skips extra files when empty array provided', async () => {
    const pieces = [{ data: new ArrayBuffer(10), label: 'piece' }];

    await packagePiecesAsZip(pieces, 'test', '.stl', []);

    expect(mockFile).toHaveBeenCalledTimes(1);
  });

  it('returns the blob from generateAsync', async () => {
    const expectedBlob = new Blob(['custom-content']);
    mockGenerateAsync.mockResolvedValue(expectedBlob);

    const pieces = [{ data: new ArrayBuffer(10), label: 'piece' }];
    const result = await packagePiecesAsZip(pieces, 'name', '.stl');

    expect(result).toBe(expectedBlob);
  });
});
