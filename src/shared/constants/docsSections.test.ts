import { describe, expect, it } from 'vitest';
import { DOCS_SECTIONS, docsSectionHref } from './docsSections';

describe('docsSectionHref', () => {
  it('points under the same-origin docs root', () => {
    expect(docsSectionHref('layoutLayers')).toBe('/docs/layouts/layers');
    expect(docsSectionHref('layoutPhysicalUnits')).toBe(
      '/docs/concepts/units#where-you-set-the-units'
    );
  });

  it('keeps every section a docs-root path', () => {
    for (const path of Object.values(DOCS_SECTIONS)) expect(path).toMatch(/^\/[a-z]/);
  });
});
