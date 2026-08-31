import { describe, it, expect } from 'vitest';
import {
  DESIGNER_CONTROL_SEARCH,
  isDesignerControlAvailable,
  type ControlAvailabilityContext,
} from './designerControlRegistry';
import { DESIGNER_SETTINGS } from '../settingsManifest';

const baseCtx: ControlAvailabilityContext = {
  style: 'standard',
  hasText: true,
  needsSplit: true,
  viewMode: 'rail',
  slideTrayEnabled: true,
};

// Controls the manifest knows about but the search deliberately does not index,
// because they lack an always-mounted anchor to jump to.
const EXCLUDED_FROM_SEARCH = ['bd-lid-grip'];

describe('designerControlRegistry', () => {
  it('covers every manifest control except the documented exclusions', () => {
    const registryIds = DESIGNER_CONTROL_SEARCH.map((e) => e.controlId).sort();
    const manifestIds = DESIGNER_SETTINGS.map((e) => e.controlId).sort();
    // every searchable control is a real manifest control
    expect(manifestIds).toEqual(expect.arrayContaining(registryIds));
    // the registry covers the manifest apart from the exclusions
    expect([...registryIds, ...EXCLUDED_FROM_SEARCH].sort()).toEqual(manifestIds);
    // the exclusions are themselves real manifest controls, so the list stays honest
    expect(manifestIds).toEqual(expect.arrayContaining(EXCLUDED_FROM_SEARCH));
  });

  it('gives every control a title, description, and keyword key', () => {
    for (const entry of DESIGNER_CONTROL_SEARCH) {
      expect(entry.titleKey).toMatch(/^help\.target\.binDesigner\./);
      expect(entry.descriptionKey).toMatch(/^help\.target\.binDesigner\./);
      expect(entry.keywordsKey).toMatch(/^help\.target\.binDesigner\./);
    }
  });

  it('treats non-conditional controls as always available', () => {
    expect(isDesignerControlAvailable('bd-dimensions', baseCtx)).toBe(true);
    expect(
      isDesignerControlAvailable('bd-dimensions', {
        style: 'solid',
        hasText: false,
        needsSplit: false,
        viewMode: 'scroll',
        slideTrayEnabled: false,
      })
    ).toBe(true);
  });

  it('hides label tabs unless the bin is a standard style', () => {
    expect(isDesignerControlAvailable('bd-label-tabs', { ...baseCtx, style: 'standard' })).toBe(
      true
    );
    expect(isDesignerControlAvailable('bd-label-tabs', { ...baseCtx, style: 'solid' })).toBe(false);
    expect(isDesignerControlAvailable('bd-label-tabs', { ...baseCtx, style: 'slotted' })).toBe(
      false
    );
  });

  it('hides typography until the design has text', () => {
    expect(isDesignerControlAvailable('bd-type', { ...baseCtx, hasText: true })).toBe(true);
    expect(isDesignerControlAvailable('bd-type', { ...baseCtx, hasText: false })).toBe(false);
  });

  it('hides the slide tray unless the labs flag is on', () => {
    expect(
      isDesignerControlAvailable('bd-slide-tray', { ...baseCtx, slideTrayEnabled: true })
    ).toBe(true);
    expect(
      isDesignerControlAvailable('bd-slide-tray', { ...baseCtx, slideTrayEnabled: false })
    ).toBe(false);
  });

  it('shows print-fit in the rail always but in the scroll only when splitting', () => {
    expect(
      isDesignerControlAvailable('bd-print-fit', {
        ...baseCtx,
        viewMode: 'rail',
        needsSplit: false,
      })
    ).toBe(true);
    expect(
      isDesignerControlAvailable('bd-print-fit', {
        ...baseCtx,
        viewMode: 'scroll',
        needsSplit: false,
      })
    ).toBe(false);
    expect(
      isDesignerControlAvailable('bd-print-fit', {
        ...baseCtx,
        viewMode: 'scroll',
        needsSplit: true,
      })
    ).toBe(true);
  });
});
