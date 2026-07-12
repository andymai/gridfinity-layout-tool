/**
 * Current schema version for each domain event type.
 *
 * When a payload shape changes, bump the version here and add a
 * migration in `migrations.ts` to upgrade persisted events.
 */

import type { DomainEventType } from '../events';

/** Maps every event type to its current schema version */
export const CURRENT_EVENT_VERSIONS: Record<DomainEventType, number> = {
  // Bin events
  'bin.added': 1,
  'bin.updated': 1,
  'bin.deleted': 1,
  'bin.batchDeleted': 1,
  'bin.duplicated': 1,
  'bin.movedToStaging': 1,
  'bin.movedFromStaging': 1,
  'bin.layerFilled': 1,
  'bin.layerCleared': 1,

  // Layer events
  'layer.added': 1,
  'layer.updated': 1,
  'layer.deleted': 1,
  'layer.reordered': 1,

  // Category events
  'category.added': 1,
  'category.updated': 1,
  'category.deleted': 1,

  // Drawer / layout metadata events
  // Still v1: `changes`/`previous` may now carry the additive optional
  // `outline` field, which old and new decoders both handle — no migration.
  'drawer.updated': 1,
  'drawer.outlineSet': 1,
  'layout.nameSet': 1,
  'layout.printBedSizeSet': 1,
  'layout.gridUnitMmSet': 1,
  'layout.heightUnitMmSet': 1,
  'layout.baseplateParamsSet': 1,
  'layout.activeBaseplateSet': 1,

  // Library events
  'library.entryCreated': 1,
  'library.entryDeleted': 1,
  'library.entryDuplicated': 1,
  'library.activeLayoutSwitched': 1,
  'library.entryUpdated': 1,
  'library.authorNameSet': 1,
  'library.cloudShareUpdated': 1,
  'library.cloudShareCleared': 1,
  'library.entryRenamed': 1,

  // Designer events
  'designer.saved': 1,

  // Restore events
  'layout.restored': 1,
};
