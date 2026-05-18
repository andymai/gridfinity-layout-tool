import { describe, it, expect } from 'vitest';
import { getAllHelpEntries } from './helpEntryAggregator';

describe('getAllHelpEntries', () => {
  it('aggregates shortcut, feature, and shell entries into one flat list', () => {
    const entries = getAllHelpEntries();
    expect(entries.length).toBeGreaterThan(0);

    const kinds = new Set(entries.map((e) => e.kind));
    expect(kinds.has('shortcut')).toBe(true);
    expect(kinds.has('feature')).toBe(true);
  });

  it('includes the print-bed-size and half-bin-mode proof-of-concept entries', () => {
    const ids = getAllHelpEntries().map((e) => e.id);
    expect(ids).toContain('feature/grid-editor/print-bed-size');
    expect(ids).toContain('feature/shell/half-bin-mode');
  });

  it('includes the expanded sidebar catalog (drawer, grid unit, height unit, layers, categories)', () => {
    const ids = getAllHelpEntries().map((e) => e.id);
    expect(ids).toContain('feature/grid-editor/drawer-size');
    expect(ids).toContain('feature/grid-editor/grid-unit');
    expect(ids).toContain('feature/grid-editor/height-unit');
    expect(ids).toContain('feature/layers/panel');
    expect(ids).toContain('feature/categories/panel');
  });

  it('produces unique ids across all entries', () => {
    const ids = getAllHelpEntries().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('feature entries always carry a target', () => {
    const features = getAllHelpEntries().filter((e) => e.kind === 'feature');
    for (const feature of features) {
      expect(feature.target.surface).toBeTruthy();
      expect(feature.target.controlId).toBeTruthy();
    }
  });

  it('filters layout-route entries out when called with currentRoute=designer', () => {
    const ids = getAllHelpEntries('designer').map((e) => e.id);
    // Layout-only entries must NOT appear in designer mode.
    expect(ids).not.toContain('feature/grid-editor/print-bed-size');
    expect(ids).not.toContain('feature/grid-editor/drawer-size');
    expect(ids).not.toContain('feature/layers/panel');
    expect(ids).not.toContain('feature/categories/panel');
    expect(ids).not.toContain('feature/shell/half-bin-mode');
    // Bin-designer entries must appear.
    expect(ids).toContain('feature/bin-designer/dimensions');
    expect(ids).toContain('feature/bin-designer/walls');
    expect(ids).toContain('feature/bin-designer/lid');
  });

  it('filters designer-route entries out when called with currentRoute=layout', () => {
    const ids = getAllHelpEntries('layout').map((e) => e.id);
    expect(ids).toContain('feature/grid-editor/print-bed-size');
    expect(ids).toContain('feature/layers/panel');
    expect(ids).not.toContain('feature/bin-designer/dimensions');
    expect(ids).not.toContain('feature/bin-designer/walls');
  });

  it('surfaces the baseplate print-bed entry only on the baseplate route', () => {
    const baseplateIds = getAllHelpEntries('baseplate').map((e) => e.id);
    expect(baseplateIds).toContain('feature/baseplate/print-bed-size');
    expect(baseplateIds).not.toContain('feature/grid-editor/print-bed-size');
    expect(baseplateIds).not.toContain('feature/bin-designer/print-bed-size');

    const layoutIds = getAllHelpEntries('layout').map((e) => e.id);
    expect(layoutIds).not.toContain('feature/baseplate/print-bed-size');

    const designerIds = getAllHelpEntries('designer').map((e) => e.id);
    expect(designerIds).not.toContain('feature/baseplate/print-bed-size');
    expect(designerIds).toContain('feature/bin-designer/print-bed-size');
  });

  it('includes mode-agnostic entries (shortcuts) on every route', () => {
    const layoutShortcuts = getAllHelpEntries('layout').filter((e) => e.kind === 'shortcut');
    const designerShortcuts = getAllHelpEntries('designer').filter((e) => e.kind === 'shortcut');
    expect(layoutShortcuts.length).toBeGreaterThan(0);
    expect(designerShortcuts.length).toBe(layoutShortcuts.length);
  });
});
