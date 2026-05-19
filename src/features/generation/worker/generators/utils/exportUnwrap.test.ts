import { describe, it, expect } from 'vitest';
import { ok, err, ioError } from 'brepjs';
import { unwrapExportBlob } from './exportUnwrap';

describe('unwrapExportBlob', () => {
  it('returns the Blob from an Ok result', () => {
    const blob = new Blob(['stl bytes']);
    const result = ok(blob);
    expect(unwrapExportBlob(result, 'STL')).toBe(blob);
  });

  it('throws a friendly Error for an STL Err, omitting "Called unwrap" jargon', () => {
    const result = err(ioError('STL_EXPORT_FAILED', 'Failed to write STL file'));
    expect(() => unwrapExportBlob(result, 'STL')).toThrow(
      /Failed to write STL file \(STL_EXPORT_FAILED\)/
    );
    expect(() => unwrapExportBlob(result, 'STL')).not.toThrow(/Called unwrap/);
  });

  it('uses the BrepError suggestion when present', () => {
    const result = err(
      ioError('STL_EXPORT_FAILED', 'Failed to write STL file', undefined, undefined, 'Try X.')
    );
    try {
      unwrapExportBlob(result, 'STL');
      expect.fail('should have thrown');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg).toContain('Try X.');
    }
  });

  it('falls back to a default suggestion when BrepError omits one', () => {
    const result = err(ioError('STL_EXPORT_FAILED', 'Failed to write STL file'));
    try {
      unwrapExportBlob(result, 'STL');
      expect.fail('should have thrown');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg).toMatch(/disabling features one at a time/i);
    }
  });

  it('falls back to the default suggestion when BrepError suggestion is an empty string', () => {
    // brepjs may serialize a missing suggestion as `""`; `??` would let it
    // through and the user would see no hint. Guard against that.
    const result = err(
      ioError('STL_EXPORT_FAILED', 'Failed to write STL file', undefined, undefined, '')
    );
    try {
      unwrapExportBlob(result, 'STL');
      expect.fail('should have thrown');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg).toMatch(/disabling features one at a time/i);
    }
  });

  it('preserves the structured BrepError via `cause`', () => {
    const brepErr = ioError('STL_EXPORT_FAILED', 'Failed to write STL file');
    const result = err(brepErr);
    try {
      unwrapExportBlob(result, 'STL');
      expect.fail('should have thrown');
    } catch (e) {
      expect(e instanceof Error && e.cause).toBe(brepErr);
      expect(e instanceof Error && e.name).toBe('ExportFailed');
    }
  });

  it('uses a STEP-specific default suggestion for STEP exports', () => {
    const result = err(ioError('STEP_EXPORT_FAILED', 'Failed to write STEP file'));
    try {
      unwrapExportBlob(result, 'STEP');
      expect.fail('should have thrown');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg).toMatch(/STEP requires valid BREP geometry/i);
    }
  });
});
