import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MANIFEST_SCREENSHOTS } from './manifestScreenshots';

function pngSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(resolve(process.cwd(), 'public/screenshots', file));
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

// Chrome drops every screenshot that breaks one of these rules, without an
// error, and then shows its small install prompt in place of the rich one.
describe('manifest screenshots', () => {
  it.each(MANIFEST_SCREENSHOTS)('$file matches its declared size', (shot) => {
    expect(pngSize(shot.file)).toEqual({ width: shot.width, height: shot.height });
  });

  it.each(MANIFEST_SCREENSHOTS)('$file fits the richer install dialog rules', (shot) => {
    const long = Math.max(shot.width, shot.height);
    const short = Math.min(shot.width, shot.height);
    expect(short).toBeGreaterThanOrEqual(320);
    expect(long).toBeLessThanOrEqual(3840);
    expect(long / short).toBeLessThanOrEqual(2.3);
  });

  it('uses one aspect ratio per form factor', () => {
    for (const formFactor of ['wide', 'narrow'] as const) {
      const ratios = new Set(
        MANIFEST_SCREENSHOTS.filter((s) => s.formFactor === formFactor).map((s) =>
          (s.width / s.height).toFixed(4)
        )
      );
      expect(ratios.size).toBe(1);
    }
  });
});
