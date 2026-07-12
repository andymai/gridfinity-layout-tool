import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { DomainEvent, DomainEventType } from '../events';
import type { EventMeta } from '../types';
import { eventId, commandId, correlationId } from '../types';
import { migrateEvent, registerMigration, clearMigrations } from './migrations';
import { CURRENT_EVENT_VERSIONS } from './eventVersions';

function createTestMeta(overrides: Partial<EventMeta> = {}): EventMeta {
  return {
    id: eventId('evt_test_1'),
    timestamp: Date.now(),
    correlationId: correlationId('corr_test_1'),
    commandId: commandId('cmd_test_1'),
    aggregateId: 'layout-test-1' as EventMeta['aggregateId'],
    version: 1,
    schemaVersion: 1,
    ...overrides,
  };
}

function createTestEvent(
  type: DomainEventType,
  meta: EventMeta,
  payload: Record<string, unknown> = {}
): DomainEvent {
  return { type, payload, meta } as unknown as DomainEvent;
}

describe('migrateEvent', () => {
  beforeEach(() => {
    clearMigrations();
  });

  it('is a no-op when event is already at current version', () => {
    const event = createTestEvent('bin.added', createTestMeta({ schemaVersion: 1 }), {
      bin: {},
    });

    const result = migrateEvent(event);

    expect(result).toEqual(event);
  });

  it('defaults missing schemaVersion to 1 and migrates', () => {
    // Temporarily bump the current version for bin.added to test migration
    const original = CURRENT_EVENT_VERSIONS['bin.added'];
    CURRENT_EVENT_VERSIONS['bin.added'] = 2;

    registerMigration('bin.added', 1, 2, (e: unknown) => {
      const event = e as DomainEvent & { payload: { migrated: boolean } };
      return {
        ...event,
        payload: { ...event.payload, migrated: true },
      };
    });

    // Create event without schemaVersion in meta
    const meta = createTestMeta();
    const metaWithout = { ...meta } as Record<string, unknown>;
    delete metaWithout['schemaVersion'];

    const event = createTestEvent('bin.added', metaWithout as EventMeta, { bin: {} });
    const result = migrateEvent(event);

    expect((result.payload as Record<string, unknown>)['migrated']).toBe(true);
    expect(result.meta.schemaVersion).toBe(2);

    // Restore
    CURRENT_EVENT_VERSIONS['bin.added'] = original;
  });

  it('runs a single migration step', () => {
    const original = CURRENT_EVENT_VERSIONS['layer.added'];
    CURRENT_EVENT_VERSIONS['layer.added'] = 2;

    registerMigration('layer.added', 1, 2, (e: unknown) => {
      const event = e as DomainEvent & { payload: Record<string, unknown> };
      return {
        ...event,
        payload: { ...event.payload, newField: 'added-in-v2' },
      };
    });

    const event = createTestEvent('layer.added', createTestMeta({ schemaVersion: 1 }), {
      layer: {},
    });
    const result = migrateEvent(event);

    expect((result.payload as Record<string, unknown>)['newField']).toBe('added-in-v2');
    expect(result.meta.schemaVersion).toBe(2);

    CURRENT_EVENT_VERSIONS['layer.added'] = original;
  });

  it('walks a multi-step migration chain (v1 -> v2 -> v3)', () => {
    const original = CURRENT_EVENT_VERSIONS['category.added'];
    CURRENT_EVENT_VERSIONS['category.added'] = 3;

    registerMigration('category.added', 1, 2, (e: unknown) => {
      const event = e as DomainEvent & { payload: Record<string, unknown> };
      return {
        ...event,
        payload: { ...event.payload, addedInV2: true },
      };
    });

    registerMigration('category.added', 2, 3, (e: unknown) => {
      const event = e as DomainEvent & { payload: Record<string, unknown> };
      return {
        ...event,
        payload: { ...event.payload, addedInV3: true },
      };
    });

    const event = createTestEvent('category.added', createTestMeta({ schemaVersion: 1 }), {
      category: {},
    });
    const result = migrateEvent(event);

    expect((result.payload as Record<string, unknown>)['addedInV2']).toBe(true);
    expect((result.payload as Record<string, unknown>)['addedInV3']).toBe(true);
    expect(result.meta.schemaVersion).toBe(3);

    CURRENT_EVENT_VERSIONS['category.added'] = original;
  });

  it('logs and returns the event unmigrated when the chain has a gap', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const original = CURRENT_EVENT_VERSIONS['drawer.updated'];
    CURRENT_EVENT_VERSIONS['drawer.updated'] = 3;

    // Only register v2->v3, no v1->v2
    registerMigration('drawer.updated', 2, 3, (e: unknown) => {
      const event = e as DomainEvent & { payload: Record<string, unknown> };
      return {
        ...event,
        payload: { ...event.payload, addedInV3: true },
      };
    });

    const event = createTestEvent('drawer.updated', createTestMeta({ schemaVersion: 1 }), {
      changes: {},
    });
    const result = migrateEvent(event);

    // Gap at v1→v2: no migration runs, the event is returned AS-IS so the
    // stored schemaVersion still reflects reality (v1). Previously the code
    // stamped a partial version (v1) AND the event later re-entered the same
    // broken migration on every read, silently looping.
    expect((result.payload as Record<string, unknown>)['addedInV3']).toBeUndefined();
    expect(result.meta.schemaVersion).toBe(1);
    expect(result).toBe(event); // returned unchanged
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Missing migration'));

    CURRENT_EVENT_VERSIONS['drawer.updated'] = original;
    errorSpy.mockRestore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});

describe('CURRENT_EVENT_VERSIONS registry completeness', () => {
  // All DomainEventType values that should be covered
  const expectedEventTypes: ReadonlyArray<DomainEventType> = [
    // Bin events
    'bin.added',
    'bin.updated',
    'bin.deleted',
    'bin.batchDeleted',
    'bin.duplicated',
    'bin.movedToStaging',
    'bin.movedFromStaging',
    'bin.layerFilled',
    'bin.layerCleared',
    // Layer events
    'layer.added',
    'layer.updated',
    'layer.deleted',
    'layer.reordered',
    // Category events
    'category.added',
    'category.updated',
    'category.deleted',
    // Drawer / layout events
    'drawer.updated',
    'drawer.outlineSet',
    'layout.nameSet',
    'layout.printBedSizeSet',
    'layout.gridUnitMmSet',
    'layout.heightUnitMmSet',
    'layout.baseplateParamsSet',
    'layout.activeBaseplateSet',
    // Library events
    'library.entryCreated',
    'library.entryDeleted',
    'library.entryDuplicated',
    'library.activeLayoutSwitched',
    'library.entryUpdated',
    'library.authorNameSet',
    'library.cloudShareUpdated',
    'library.cloudShareCleared',
    'library.entryRenamed',
    // Designer events
    'designer.saved',
    // Restore events
    'layout.restored',
  ];

  it.each(expectedEventTypes)('has a version entry for %s', (eventType) => {
    expect(CURRENT_EVENT_VERSIONS[eventType]).toBeDefined();
    expect(typeof CURRENT_EVENT_VERSIONS[eventType]).toBe('number');
    expect(CURRENT_EVENT_VERSIONS[eventType]).toBeGreaterThanOrEqual(1);
  });

  it('covers all DomainEventType values (no missing keys)', () => {
    const registryKeys = Object.keys(CURRENT_EVENT_VERSIONS);
    expect(registryKeys.sort()).toEqual([...expectedEventTypes].sort());
  });
});
