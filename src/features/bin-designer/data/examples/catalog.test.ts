import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { EXAMPLE_DESIGNS } from './index';
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

  // TODO: unskip once binExamples i18n keys are added (Task 12/13)
  it.skip('every i18n key exists in English bundle', () => {
    // en is a flat Record<string, string> with dotted keys
    void import('@/i18n/locales/en').then(({ default: en }) => {
      for (const e of EXAMPLE_DESIGNS) {
        expect(e.nameKey in en, `${e.id} nameKey "${e.nameKey}" missing from en`).toBe(true);
        expect(
          e.descriptionKey in en,
          `${e.id} descriptionKey "${e.descriptionKey}" missing from en`
        ).toBe(true);
      }
    });
  });

  it('every thumbnail asset exists on disk', () => {
    for (const e of EXAMPLE_DESIGNS) {
      const rel = e.thumbnail.replace(/^\//, '');
      expect(existsSync(resolve(process.cwd(), rel)), `${e.id} thumbnail missing`).toBe(true);
    }
  });
});
