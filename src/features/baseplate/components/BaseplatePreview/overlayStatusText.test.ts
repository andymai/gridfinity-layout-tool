import { describe, it, expect } from 'vitest';
import { overlayStatusText } from './overlayStatusText';

const mockT = (key: string) => key;

describe('overlayStatusText', () => {
  it('returns initializing message when wasm is loading', () => {
    expect(overlayStatusText(true, null, null, mockT)).toBe('baseplate.initializingEngine');
  });

  it('returns generating message when no split progress', () => {
    expect(overlayStatusText(false, null, null, mockT)).toBe('baseplate.generating');
  });

  it('returns split progress message', () => {
    expect(overlayStatusText(false, { current: 2, total: 6 }, null, mockT)).toBe(
      'baseplate.generatingSplit'
    );
  });

  it('returns dedup progress message when duplicates exist', () => {
    const result = overlayStatusText(
      false,
      { current: 2, total: 6 },
      { uniqueCount: 3, duplicatesSkipped: 2 },
      mockT
    );
    expect(result).toBe('baseplate.generation.dedupProgress');
  });

  it('returns split progress when dedup has zero skipped', () => {
    const result = overlayStatusText(
      false,
      { current: 2, total: 6 },
      { uniqueCount: 6, duplicatesSkipped: 0 },
      mockT
    );
    expect(result).toBe('baseplate.generatingSplit');
  });
});
