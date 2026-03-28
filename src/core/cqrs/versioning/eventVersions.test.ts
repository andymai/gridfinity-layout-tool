import { describe, it, expect } from 'vitest';
import { CURRENT_EVENT_VERSIONS } from './eventVersions';

describe('eventVersions', () => {
  it('defines versions for all bin events', () => {
    expect(CURRENT_EVENT_VERSIONS['bin.added']).toBeDefined();
    expect(CURRENT_EVENT_VERSIONS['bin.updated']).toBeDefined();
    expect(CURRENT_EVENT_VERSIONS['bin.deleted']).toBeDefined();
    expect(CURRENT_EVENT_VERSIONS['bin.batchDeleted']).toBeDefined();
    expect(CURRENT_EVENT_VERSIONS['bin.duplicated']).toBeDefined();
    expect(CURRENT_EVENT_VERSIONS['bin.movedToStaging']).toBeDefined();
    expect(CURRENT_EVENT_VERSIONS['bin.movedFromStaging']).toBeDefined();
    expect(CURRENT_EVENT_VERSIONS['bin.layerFilled']).toBeDefined();
    expect(CURRENT_EVENT_VERSIONS['bin.layerCleared']).toBeDefined();
  });

  it('defines versions for all layer events', () => {
    expect(CURRENT_EVENT_VERSIONS['layer.added']).toBeDefined();
    expect(CURRENT_EVENT_VERSIONS['layer.updated']).toBeDefined();
    expect(CURRENT_EVENT_VERSIONS['layer.deleted']).toBeDefined();
    expect(CURRENT_EVENT_VERSIONS['layer.reordered']).toBeDefined();
  });

  it('defines versions for all category events', () => {
    expect(CURRENT_EVENT_VERSIONS['category.added']).toBeDefined();
    expect(CURRENT_EVENT_VERSIONS['category.updated']).toBeDefined();
    expect(CURRENT_EVENT_VERSIONS['category.deleted']).toBeDefined();
  });

  it('defines versions for drawer and layout events', () => {
    expect(CURRENT_EVENT_VERSIONS['drawer.updated']).toBeDefined();
    expect(CURRENT_EVENT_VERSIONS['layout.nameSet']).toBeDefined();
    expect(CURRENT_EVENT_VERSIONS['layout.printBedSizeSet']).toBeDefined();
    expect(CURRENT_EVENT_VERSIONS['layout.baseplateParamsSet']).toBeDefined();
  });

  it('defines versions for library events', () => {
    expect(CURRENT_EVENT_VERSIONS['library.entryCreated']).toBeDefined();
    expect(CURRENT_EVENT_VERSIONS['library.entryDeleted']).toBeDefined();
    expect(CURRENT_EVENT_VERSIONS['library.entryDuplicated']).toBeDefined();
    expect(CURRENT_EVENT_VERSIONS['library.activeLayoutSwitched']).toBeDefined();
  });

  it('all versions are positive integers', () => {
    for (const [type, version] of Object.entries(CURRENT_EVENT_VERSIONS)) {
      expect(version, `${type} should have positive integer version`).toBeGreaterThan(0);
      expect(Number.isInteger(version), `${type} version should be integer`).toBe(true);
    }
  });
});
