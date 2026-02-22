import { describe, it, expect } from 'vitest';
import { buildSlicerUrl } from './slicerConfig';

describe('buildSlicerUrl', () => {
  it('builds a protocol URL with encoded file URL', () => {
    const result = buildSlicerUrl('prusaslicer', 'https://example.com/file.3mf');
    expect(result).toBe('prusaslicer://open?file_url=https%3A%2F%2Fexample.com%2Ffile.3mf');
  });

  it('encodes query parameters and ampersands in the file URL', () => {
    const result = buildSlicerUrl(
      'orcaslicer',
      'https://blob.vercel.com/slicer-temp/uuid.3mf?foo=bar&baz=qux'
    );
    expect(result).toBe(
      'orcaslicer://open?file_url=https%3A%2F%2Fblob.vercel.com%2Fslicer-temp%2Fuuid.3mf%3Ffoo%3Dbar%26baz%3Dqux'
    );
  });

  it('uses the provided protocol as the scheme', () => {
    const result = buildSlicerUrl('bambustudio', 'https://example.com/file.3mf');
    expect(result).toMatch(/^bambustudio:\/\/open\?file_url=/);
  });

  it('encodes spaces and special chars in the file URL', () => {
    const result = buildSlicerUrl('prusaslicer', 'https://example.com/my file (1).3mf');
    expect(result).toContain('my%20file%20(1).3mf');
  });
});
