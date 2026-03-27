/**
 * Static Middleware Registry
 *
 * Maps command types to middleware profiles that control which middleware
 * runs for each command. Matches the pattern used by getCommandSchema().
 *
 * Profiles determine:
 * - validation: Zod schema validation
 * - undo: Undo capture (snapshot before execution)
 * - analytics: PostHog event tracking
 * - logging: Dev console logging
 * - persistEvents: Whether events go to IndexedDB event store
 */

import type { CommandType } from '../commands';

export type MiddlewareProfile = 'domain' | 'library' | 'designer' | 'restore' | 'ui';

export interface MiddlewareFlags {
  readonly validation: boolean;
  readonly undo: boolean;
  readonly analytics: boolean;
  readonly logging: boolean;
  readonly persistEvents: boolean;
}

const PROFILES: Readonly<Record<MiddlewareProfile, MiddlewareFlags>> = {
  domain: { validation: true, undo: true, analytics: true, logging: true, persistEvents: true },
  library: { validation: true, undo: false, analytics: true, logging: true, persistEvents: true },
  designer: {
    validation: true,
    undo: false,
    analytics: true,
    logging: true,
    persistEvents: true,
  },
  restore: {
    validation: false,
    undo: false,
    analytics: true,
    logging: true,
    persistEvents: true,
  },
  ui: { validation: false, undo: false, analytics: true, logging: true, persistEvents: false },
};

const COMMAND_PROFILES: Readonly<Record<CommandType, MiddlewareProfile>> = {
  // Existing domain commands (23)
  'bin.add': 'domain',
  'bin.update': 'domain',
  'bin.delete': 'domain',
  'bin.deleteBatch': 'domain',
  'bin.duplicate': 'domain',
  'bin.moveToStaging': 'domain',
  'bin.moveFromStaging': 'domain',
  'bin.fillLayer': 'domain',
  'bin.fillGaps': 'domain',
  'bin.clearLayer': 'domain',
  'layer.add': 'domain',
  'layer.update': 'domain',
  'layer.delete': 'domain',
  'layer.reorder': 'domain',
  'category.add': 'domain',
  'category.update': 'domain',
  'category.delete': 'domain',
  'drawer.update': 'domain',
  'layout.setName': 'domain',
  'layout.setPrintBedSize': 'domain',
  'layout.setGridUnitMm': 'domain',
  'layout.setHeightUnitMm': 'domain',
  'layout.setBaseplateParams': 'domain',

  // Library commands
  'library.createEntry': 'library',
  'library.deleteEntry': 'library',
  'library.duplicateEntry': 'library',
  'library.switchActive': 'library',
  'library.updateEntry': 'library',
  'library.setAuthorName': 'library',
  'library.setCloudShare': 'library',
  'library.clearCloudShare': 'library',
  'library.renameEntry': 'library',
  'library.importLayout': 'library',

  // Designer
  'designer.save': 'designer',

  // Restore
  'layout.restore': 'restore',

  // UI analytics
  'ui.pageView': 'ui',
  'ui.modalOpen': 'ui',
  'ui.modalClose': 'ui',
  'ui.featureUsed': 'ui',
  'ui.shareAttempt': 'ui',
  'ui.shareComplete': 'ui',
  'ui.shareFailed': 'ui',
  'ui.onboardingStep': 'ui',
  'ui.templateApplied': 'ui',
  'ui.layoutExported': 'ui',
};

/** Look up middleware flags for a command type. Defaults to domain profile. */
export function getMiddlewareFlags(type: CommandType): MiddlewareFlags {
  return PROFILES[COMMAND_PROFILES[type]] ?? PROFILES.domain;
}
