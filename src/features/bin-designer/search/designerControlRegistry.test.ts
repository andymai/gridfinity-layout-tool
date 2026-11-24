import { describe, it, expect } from 'vitest';
import { DESIGNER_CONTROL_SEARCH, DESIGNER_OPTION_RECORDS } from './designerControlRegistry';
import { DESIGNER_SETTINGS } from '../settingsManifest';

const SECTION_IDS = new Set(DESIGNER_CONTROL_SEARCH.map((s) => s.controlId));

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

  it('anchors every sub-option to a real section and gives it synonyms', () => {
    const ids = new Set<string>();
    for (const opt of DESIGNER_OPTION_RECORDS) {
      expect(SECTION_IDS.has(opt.section)).toBe(true);
      expect(opt.labelKey.length).toBeGreaterThan(0);
      expect(opt.keywords.length).toBeGreaterThan(0);
      expect(ids.has(opt.id)).toBe(false); // ids are unique
      ids.add(opt.id);
    }
  });
});
