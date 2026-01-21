/**
 * Labs feature module.
 *
 * Note: The labs store and type definitions have been moved to core/
 * as they are infrastructure used throughout the application.
 *
 * - Types and feature definitions: import from '@/core/labs'
 * - Store (useLabsStore): import from '@/core/store'
 *
 * This module now only exports the UI components for the Labs feature.
 */

// UI Components (remain in features)
export * from './components';

// Re-exports for backward compatibility (deprecated)
export * from './store';
export * from './definitions';
