/**
 * Event Migration Infrastructure
 *
 * Provides a registry of migration functions that upgrade persisted
 * events from older schema versions to the current version.
 *
 * Migration chains are walked automatically: an event at v1 with
 * current version v3 will run v1->v2 then v2->v3.
 */

import type { DomainEvent, DomainEventType } from '../events';
import { CURRENT_EVENT_VERSIONS } from './eventVersions';

/** A function that transforms an event payload from one schema version to the next */
export type MigrationFn = (event: unknown) => unknown;

/**
 * Registry key: `${eventType}:${fromVersion}->${toVersion}`
 * Each entry migrates a single version step.
 */
const migrationRegistry = new Map<string, MigrationFn>();

function migrationKey(eventType: string, fromVersion: number, toVersion: number): string {
  return `${eventType}:${String(fromVersion)}->${String(toVersion)}`;
}

/**
 * Register a migration step for a specific event type.
 *
 * @param eventType - The domain event type string (e.g. 'bin.added')
 * @param fromVersion - Schema version the event is migrating from
 * @param toVersion - Schema version the event is migrating to (typically fromVersion + 1)
 * @param fn - Pure function that transforms the event shape
 */
export function registerMigration(
  eventType: DomainEventType,
  fromVersion: number,
  toVersion: number,
  fn: MigrationFn
): void {
  const key = migrationKey(eventType, fromVersion, toVersion);
  migrationRegistry.set(key, fn);
}

/**
 * Migrate a persisted event to the current schema version.
 *
 * Events missing `schemaVersion` are assumed to be v1 (pre-versioning).
 * Returns the event unmodified if already at the current version or
 * if the event type is unknown (removed/unrecognized types from IndexedDB).
 */
export function migrateEvent(event: DomainEvent): DomainEvent {
  const eventType = event.type;
  const currentVersion = (
    CURRENT_EVENT_VERSIONS as Readonly<Record<string, number | undefined>>
  )[eventType];

  // Unknown event type (e.g., removed from the codebase) — return as-is
  if (currentVersion === undefined) return event;

  const eventVersion =
    (event.meta as unknown as Readonly<Record<string, unknown>>).schemaVersion ?? 1;

  if (typeof eventVersion !== 'number') return event;
  if (eventVersion >= currentVersion) return event;

  let migrated: unknown = event;
  let reachedVersion = eventVersion;
  for (let v = eventVersion; v < currentVersion; v++) {
    const key = migrationKey(eventType, v, v + 1);
    const fn = migrationRegistry.get(key);
    if (fn) {
      migrated = fn(migrated);
      reachedVersion = v + 1;
    } else {
      // Gap in migration chain — stop at the last successfully migrated version
      break;
    }
  }

  // Only stamp schemaVersion if migrations actually ran or we're already current
  const result = migrated as DomainEvent;
  return {
    ...result,
    meta: { ...result.meta, schemaVersion: reachedVersion },
  };
}

/** Clear all registered migrations (for testing) */
export function clearMigrations(): void {
  migrationRegistry.clear();
}
