/**
 * Shared types for keyboard handler functions.
 *
 * Keyboard handlers are pure functions that receive a KeyboardEvent and
 * a KeyboardContext containing all required state and actions. Each returns
 * `true` if it handled the event (short-circuiting further handlers).
 */

import type { Layout, Bin, BinId, LayerId, CategoryId } from '@/core/types';
import type { Result, LayoutError, ValidationError } from '@/core/result';
import type { TFunction } from '@/i18n';

/**
 * All state and actions needed by keyboard handlers.
 * Built by useKeyboard from store subscriptions and passed to each handler.
 */
export interface KeyboardContext {
  layout: Layout;
  selectedBinIds: BinId[];
  focusedBinId: BinId | null;
  activeLayerId: LayerId;
  activeCategoryId: CategoryId;

  // History
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  // Selection
  setSelectedBins: (ids: BinId[]) => void;
  setActiveLayer: (id: LayerId) => void;
  setActiveCategory: (id: CategoryId) => void;
  showQuickLabel: (binId: BinId) => void;

  // Interaction
  setInteraction: (interaction: null) => void;
  setPaintSize: (size: null) => void;

  // View
  zoomIn: () => void;
  zoomOut: () => void;
  setShowLayoutManager: (show: boolean) => void;

  // Mutations
  batch: <T>(fn: () => T) => T;
  deleteBin: (id: BinId) => void;
  duplicateBin: (id: BinId) => Result<BinId, ValidationError | LayoutError>;
  updateBin: (id: BinId, updates: Partial<Bin>) => void;

  // Mode toggles
  toggleHalfBinMode: () => Result<undefined, LayoutError>;

  // Navigation
  handleNavigationKey: (key: string) => void;
  navigateToDesigner: () => void;

  // Feedback
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  t: TFunction;
}

/** A keyboard handler returns true if it handled the event. */
export type KeyboardHandler = (e: KeyboardEvent, ctx: KeyboardContext) => boolean;
