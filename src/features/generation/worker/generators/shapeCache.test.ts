import { describe, it, expect } from 'vitest';
import { socketCacheKey } from './shapeCache';

describe('socketCacheKey', () => {
  it('produces deterministic key from parameters', () => {
    const key = socketCacheKey(2, 2, true, false, 3.1, 2.0, 1.5, false, false);
    expect(key).toBe('2|2|true|false|3.1|2|1.5|false|false');
  });

  it('differs when magnet flag changes', () => {
    const a = socketCacheKey(1, 1, true, false, 3.1, 2.0, 1.5, false, false);
    const b = socketCacheKey(1, 1, false, false, 3.1, 2.0, 1.5, false, false);
    expect(a).not.toBe(b);
  });

  it('differs when halfSockets changes', () => {
    const a = socketCacheKey(2, 2, false, false, 3.1, 2.0, 1.5, false, false);
    const b = socketCacheKey(2, 2, false, false, 3.1, 2.0, 1.5, false, true);
    expect(a).not.toBe(b);
  });

  it('differs when forExport changes', () => {
    const a = socketCacheKey(2, 2, false, false, 3.1, 2.0, 1.5, false, false);
    const b = socketCacheKey(2, 2, false, false, 3.1, 2.0, 1.5, true, false);
    expect(a).not.toBe(b);
  });

  it('differs when grid dimensions change', () => {
    const a = socketCacheKey(1, 2, false, false, 3.1, 2.0, 1.5, false, false);
    const b = socketCacheKey(2, 2, false, false, 3.1, 2.0, 1.5, false, false);
    expect(a).not.toBe(b);
  });

  it('differs when magnet radius changes', () => {
    const a = socketCacheKey(1, 1, true, false, 3.0, 2.0, 1.5, false, false);
    const b = socketCacheKey(1, 1, true, false, 3.2, 2.0, 1.5, false, false);
    expect(a).not.toBe(b);
  });

  it('includes all parameters in key', () => {
    const key = socketCacheKey(1.5, 2.5, true, true, 3.1, 2.4, 1.75, true, true);
    expect(key).toContain('1.5');
    expect(key).toContain('2.5');
    expect(key).toContain('true');
    expect(key).toContain('3.1');
    expect(key).toContain('2.4');
    expect(key).toContain('1.75');
  });
});
