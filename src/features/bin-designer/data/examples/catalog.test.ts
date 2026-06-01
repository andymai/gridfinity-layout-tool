import { describe, it, expect } from 'vitest';
import { EXAMPLE_DESIGNS } from './index';
import { thumbnailUrl } from './thumbnails';
import { meshUrl } from './meshes';
import { validateBinParams } from '@/features/bin-designer/utils/validation';
import { isOk } from '@/core/result';

describe('example catalog integrity', () => {
  it('has unique ids', () => {
    const ids = EXAMPLE_DESIGNS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every preset passes validateBinParams', () => {
    for (const e of EXAMPLE_DESIGNS) {
      expect(isOk(validateBinParams(e.params)), `${e.id} failed validation`).toBe(true);
    }
  });

  it('metrics match params', () => {
    for (const e of EXAMPLE_DESIGNS) {
      expect(e.metrics.width, e.id).toBe(e.params.width);
      expect(e.metrics.depth, e.id).toBe(e.params.depth);
      expect(e.metrics.height, e.id).toBe(e.params.height);
    }
  });

  it('every i18n key exists in English bundle', async () => {
    // en is a flat Record<string, string> with dotted keys
    const { default: en } = await import('@/i18n/locales/en');
    for (const e of EXAMPLE_DESIGNS) {
      expect(e.nameKey in en, `${e.id} nameKey "${e.nameKey}" missing from en`).toBe(true);
      expect(
        e.descriptionKey in en,
        `${e.id} descriptionKey "${e.descriptionKey}" missing from en`
      ).toBe(true);
    }
  });

  it('every example resolves to a bundled thumbnail URL', () => {
    // Asserts the asset is actually emitted by Vite (a committed-but-unimported
    // PNG would 404 at runtime); stronger than a filesystem-existence check.
    for (const e of EXAMPLE_DESIGNS) {
      expect(thumbnailUrl(e.id), `${e.id} thumbnail not bundled`).toBeTruthy();
    }
  });

  it('every example has a bundled mesh', () => {
    for (const e of EXAMPLE_DESIGNS) {
      expect(meshUrl(e.id), `${e.id} mesh not bundled`).toBeTruthy();
    }
  });
});
