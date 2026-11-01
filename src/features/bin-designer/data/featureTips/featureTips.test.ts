import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import en from '@/i18n/locales/en';
import { FEATURE_TIPS } from './index';
import type { FeatureTipId } from './index';

const CLIPS = join(__dirname, 'clips');
const THEMES = ['light', 'dark'] as const;
const ids = Object.keys(FEATURE_TIPS) as FeatureTipId[];

describe('feature tips', () => {
  it.each(ids)('%s has a clip and a poster for each theme', (id) => {
    for (const theme of THEMES) {
      expect(existsSync(join(CLIPS, `${id}.${theme}.mp4`))).toBe(true);
      expect(existsSync(join(CLIPS, `${id}.${theme}.webp`))).toBe(true);
    }
  });

  it.each(ids)('%s has a caption and chip labels in en.ts', (id) => {
    const { captionKey, chips = [] } = FEATURE_TIPS[id];
    for (const key of [captionKey, ...chips.map((c) => c.labelKey)]) {
      expect(en).toHaveProperty([key]);
    }
  });

  it.each(ids)('%s chips start the clip and run in order', (id) => {
    const starts = (FEATURE_TIPS[id].chips ?? []).map((c) => c.fromSeconds);
    if (starts.length === 0) return;
    expect(starts[0]).toBe(0);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it('keeps no clip that no tip plays', () => {
    const expected = new Set(
      ids.flatMap((id) => THEMES.flatMap((theme) => [`${id}.${theme}.mp4`, `${id}.${theme}.webp`]))
    );
    expect(readdirSync(CLIPS).filter((file) => !expected.has(file))).toEqual([]);
  });
});
