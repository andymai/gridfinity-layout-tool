import { describe, it, expect } from 'vitest';
import { overlayStatusText } from './overlayStatusText';

const mockT = (key: string) => key;

describe('overlayStatusText', () => {
  it('returns loading-engine message when wasm is loading and no preview yet', () => {
    expect(overlayStatusText(true, null, null, false, mockT)).toBe('baseplate.loadingEngine');
  });

  it('returns computing-geometry message when direct-mesh preview is visible while BREP runs', () => {
    expect(overlayStatusText(false, null, null, true, mockT)).toBe('baseplate.computingGeometry');
  });

  it('falls back to generic generating when no preview and wasm ready', () => {
    expect(overlayStatusText(false, null, null, false, mockT)).toBe('baseplate.generating');
  });

  it('split progress takes priority over wasm-loading state', () => {
    expect(overlayStatusText(true, { current: 2, total: 6 }, null, false, mockT)).toBe(
      'baseplate.generatingSplit'
    );
  });

  it('split progress takes priority over direct-preview state', () => {
    expect(overlayStatusText(false, { current: 2, total: 6 }, null, true, mockT)).toBe(
      'baseplate.generatingSplit'
    );
  });

  it('returns dedup progress message when duplicates exist', () => {
    const result = overlayStatusText(
      false,
      { current: 2, total: 6 },
      { uniqueCount: 3, duplicatesSkipped: 2 },
      false,
      mockT
    );
    expect(result).toBe('baseplate.generation.dedupProgress');
  });

  it('returns split progress when dedup has zero skipped', () => {
    const result = overlayStatusText(
      false,
      { current: 2, total: 6 },
      { uniqueCount: 6, duplicatesSkipped: 0 },
      false,
      mockT
    );
    expect(result).toBe('baseplate.generatingSplit');
  });
});
