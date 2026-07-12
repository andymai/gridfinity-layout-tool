/**
 * Static Middleware Registry
 *
 * Maps command types to middleware profiles that control which middleware
 * runs for each command. Matches the pattern used by getCommandSchema().
 *
 * Currently enforced flags:
 * - validation: Checked by validationMiddleware (skip if false)
 * - undo: Checked by undoCaptureMiddleware (skip if false)
 */

import type { CommandType } from '../commands';

export type MiddlewareProfile = 'domain' | 'library' | 'designer' | 'restore';

export interface MiddlewareFlags {
  readonly validation: boolean;
  readonly undo: boolean;
}

const PROFILES: Readonly<Record<MiddlewareProfile, MiddlewareFlags>> = {
  domain: { validation: true, undo: true },
  library: { validation: true, undo: false },
  designer: { validation: true, undo: false },
  restore: { validation: false, undo: false },
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
  'drawer.setOutline': 'domain',
  'layout.setName': 'domain',
  'layout.setPrintBedSize': 'domain',
  'layout.setGridUnitMm': 'domain',
  'layout.setHeightUnitMm': 'domain',
  'layout.setBaseplateParams': 'domain',
  'layout.setActiveBaseplate': 'domain',

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
};

/** Look up middleware flags for a command type. Defaults to domain profile. */
export function getMiddlewareFlags(type: CommandType): MiddlewareFlags {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Records are typed exhaustively but tests exercise the runtime fallback with unregistered command types
  return PROFILES[COMMAND_PROFILES[type]] ?? PROFILES.domain;
}
