import { describe, it, expect, vi } from 'vitest';
import { packageSplitPiecesAsZip } from './splitExport';

// Mock JSZip
const mockFile = vi.fn();
const mockGenerateAsync = vi.fn().mockResolvedValue(new Blob(['zip-content']));

vi.mock('jszip', () => ({
  default: class MockJSZip {
    file = mockFile;
    generateAsync = mockGenerateAsync;
  },
}));

describe('packageSplitPiecesAsZip', () => {
  beforeEach(() => {
    mockFile.mockClear();
    mockGenerateAsync.mockClear();
  });

  it('creates a ZIP with one file per piece', async () => {
    const pieces = [
      { data: new ArrayBuffer(100), label: 'piece-1x1', col: 1, row: 1 },
      { data: new ArrayBuffer(200), label: 'piece-2x1', col: 2, row: 1 },
    ];

    const blob = await packageSplitPiecesAsZip(pieces, 'my-bin');

    expect(blob).toBeInstanceOf(Blob);
    expect(mockFile).toHaveBeenCalledTimes(2);
    expect(mockFile).toHaveBeenCalledWith('my-bin_piece-1x1.stl', pieces[0].data);
    expect(mockFile).toHaveBeenCalledWith('my-bin_piece-2x1.stl', pieces[1].data);
    expect(mockGenerateAsync).toHaveBeenCalledWith({
      type: 'blob',
      compression: 'DEFLATE',
    });
  });

  it('handles single piece', async () => {
    const pieces = [{ data: new ArrayBuffer(50), label: 'piece-1x1', col: 1, row: 1 }];

    await packageSplitPiecesAsZip(pieces, 'test');

    expect(mockFile).toHaveBeenCalledTimes(1);
    expect(mockFile).toHaveBeenCalledWith('test_piece-1x1.stl', pieces[0].data);
  });
});
