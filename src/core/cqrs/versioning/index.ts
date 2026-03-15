/**
 * Event Versioning barrel
 */

export { CURRENT_EVENT_VERSIONS } from './eventVersions';
export { migrateEvent, registerMigration, clearMigrations } from './migrations';
export type { MigrationFn } from './migrations';
