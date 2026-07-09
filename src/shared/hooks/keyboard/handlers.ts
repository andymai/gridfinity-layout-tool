/**
 * Pure keyboard handler functions for the layout editor.
 *
 * Each handler receives a KeyboardEvent and a KeyboardContext, and returns
 * `true` if it handled the event. The main `useKeyboard` hook dispatches
 * to these in priority order.
 *
 * Handlers are grouped by feature area but exported individually so the
 * dispatch order in useKeyboard.ts is explicit and easy to reorder.
 */

import { useLayoutStore } from '@/core/store/layout';
import { SHORTCUTS, STAGING_ID, hasFractionalDimensions } from '@/core/constants';
import { canPlaceBin } from '@/shared/utils/validation';
import { validateBinRotation } from '@/shared/utils/binLocation';
import { validateHalfGridModeToggle } from '@/shared/utils/halfGridConstraints';
import { getLayerBins } from '@/shared/utils/bins';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import { findBinById, findBinsByIds } from '@/shared/utils/entity';
import { findNearestBin } from '@/features/grid-editor/utils/navigation';
import { isOk, isErr } from '@/core/result';
import type { BinId, GridUnits } from '@/core/types';
import type { KeyboardContext } from './types';

function isShortcut(key: string, shortcuts: readonly string[]): boolean {
  return shortcuts.includes(key);
}

// ── Selection & Editing ─────────────────────────────────────

export function handleDelete(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  if (!isShortcut(e.key, SHORTCUTS.DELETE) || ctx.selectedBinIds.length === 0) return false;
  e.preventDefault();
  mlTracking.trackBinsDeletion(findBinsByIds(ctx.layout, ctx.selectedBinIds), 'key');

  // If the keyboard-focused bin is among those being deleted, relocate focus to
  // the nearest survivor so screen-reader/keyboard users aren't dropped to the
  // document body. Computed before deletion while the focused bin still exists.
  const deletedIds = new Set(ctx.selectedBinIds);
  const focusedBin =
    ctx.focusedBinId !== null && deletedIds.has(ctx.focusedBinId)
      ? findBinById(ctx.layout, ctx.focusedBinId)
      : null;
  const nextFocusBin = focusedBin
    ? findNearestBin(
        focusedBin,
        ctx.layout.bins.filter((b) => !deletedIds.has(b.id)),
        ctx.activeLayerId
      )
    : null;

  ctx.batch(() => {
    for (const binId of ctx.selectedBinIds) {
      ctx.deleteBin(binId);
    }
  });
  ctx.setSelectedBins([]);
  if (focusedBin) {
    ctx.setFocusedBin(nextFocusBin ? nextFocusBin.id : null);
  }
  return true;
}

export function handleEscape(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  if (!isShortcut(e.key, SHORTCUTS.ESCAPE)) return false;
  e.preventDefault();
  ctx.setInteraction(null);
  ctx.setSelectedBins([]);
  ctx.setPaintSize(null);
  return true;
}

export function handleDuplicate(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  const ctrlOrMeta = e.ctrlKey || e.metaKey;
  if (!ctrlOrMeta || e.key.toLowerCase() !== SHORTCUTS.DUPLICATE || ctx.selectedBinIds.length === 0)
    return false;
  e.preventDefault();
  ctx.batch(() => {
    const newIds: BinId[] = [];
    for (const binId of ctx.selectedBinIds) {
      const result = ctx.duplicateBin(binId);
      if (isOk(result)) {
        newIds.push(result.value);
        const newBin = findBinById(useLayoutStore.getState().layout, result.value);
        if (newBin) {
          mlTracking.trackPlacement(newBin, 'duplicate');
        }
      }
    }
    if (newIds.length > 0) {
      ctx.setSelectedBins(newIds);
    }
  });
  return true;
}

// ── History ─────────────────────────────────────────────────

export function handleUndo(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  const ctrlOrMeta = e.ctrlKey || e.metaKey;
  if (!ctrlOrMeta || e.key.toLowerCase() !== SHORTCUTS.UNDO || e.shiftKey) return false;
  e.preventDefault();
  if (ctx.canUndo) ctx.undo();
  return true;
}

export function handleRedo(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  const ctrlOrMeta = e.ctrlKey || e.metaKey;
  if (
    !ctrlOrMeta ||
    !(e.key.toLowerCase() === SHORTCUTS.REDO || (e.key === SHORTCUTS.REDO_ALT && e.shiftKey))
  )
    return false;
  e.preventDefault();
  if (ctx.canRedo) ctx.redo();
  return true;
}

// ── View & Navigation ───────────────────────────────────────

export function handleLayoutManager(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  const ctrlOrMeta = e.ctrlKey || e.metaKey;
  if (!ctrlOrMeta || e.key.toLowerCase() !== SHORTCUTS.LAYOUT_MANAGER) return false;
  e.preventDefault();
  ctx.setShowLayoutManager(true);
  return true;
}

export function handleZoom(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  if (isShortcut(e.key, SHORTCUTS.ZOOM_IN)) {
    e.preventDefault();
    ctx.zoomIn();
    return true;
  }
  if (isShortcut(e.key, SHORTCUTS.ZOOM_OUT)) {
    e.preventDefault();
    ctx.zoomOut();
    return true;
  }
  return false;
}

export function handleLayerNavigation(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  const ctrlOrMeta = e.ctrlKey || e.metaKey;
  if (ctrlOrMeta) return false;

  const key = e.key.toLowerCase();
  if (key === SHORTCUTS.LAYER_UP) {
    e.preventDefault();
    const currentIndex = ctx.layout.layers.findIndex((l) => l.id === ctx.activeLayerId);
    if (currentIndex < ctx.layout.layers.length - 1) {
      ctx.setActiveLayer(ctx.layout.layers[currentIndex + 1].id);
    }
    return true;
  }
  if (key === SHORTCUTS.LAYER_DOWN) {
    e.preventDefault();
    const currentIndex = ctx.layout.layers.findIndex((l) => l.id === ctx.activeLayerId);
    if (currentIndex > 0) {
      ctx.setActiveLayer(ctx.layout.layers[currentIndex - 1].id);
    }
    return true;
  }
  return false;
}

export function handleBinCycling(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  const ctrlOrMeta = e.ctrlKey || e.metaKey;
  if (ctrlOrMeta) return false;

  const key = e.key.toLowerCase();
  if (key !== SHORTCUTS.SELECT_PREV_BIN && key !== SHORTCUTS.SELECT_NEXT_BIN) return false;

  e.preventDefault();
  const layerBins = getLayerBins(ctx.layout.bins, ctx.activeLayerId).sort((a, b) =>
    a.y === b.y ? a.x - b.x : a.y - b.y
  );
  if (layerBins.length === 0) return true;

  const currentId = ctx.selectedBinIds[0];
  const currentIndex = layerBins.findIndex((b) => b.id === currentId);

  if (key === SHORTCUTS.SELECT_PREV_BIN) {
    const prevIndex = currentIndex <= 0 ? layerBins.length - 1 : currentIndex - 1;
    ctx.setSelectedBins([layerBins[prevIndex].id]);
  } else {
    const nextIndex =
      currentIndex < 0 || currentIndex >= layerBins.length - 1 ? 0 : currentIndex + 1;
    ctx.setSelectedBins([layerBins[nextIndex].id]);
  }
  return true;
}

// ── Bin Transforms ──────────────────────────────────────────

export function handleRotate(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  const ctrlOrMeta = e.ctrlKey || e.metaKey;
  if (e.key.toLowerCase() !== SHORTCUTS.ROTATE || ctrlOrMeta || ctx.selectedBinIds.length !== 1)
    return false;
  e.preventDefault();

  const bin = findBinById(ctx.layout, ctx.selectedBinIds[0]);
  if (!bin) return true;

  const result = validateBinRotation(bin, ctx.layout);
  if (!result.valid) {
    ctx.addToast(result.message, 'error');
    return true;
  }

  ctx.batch(() => {
    const updates: Partial<typeof bin> = { width: bin.depth, depth: bin.width };
    if (result.movedTo) {
      updates.x = result.movedTo.x as GridUnits;
      updates.y = result.movedTo.y as GridUnits;
    }
    ctx.updateBin(bin.id, updates);
  });

  if (result.movedTo) {
    ctx.addToast(ctx.t('toast.rotateRepositioned', { distance: result.movedTo.distance }), 'info');
  }
  return true;
}

export function handleCategoryCycling(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  if (e.key !== SHORTCUTS.CATEGORY_PREV && e.key !== SHORTCUTS.CATEGORY_NEXT) return false;
  e.preventDefault();

  const categories = ctx.layout.categories;
  if (categories.length === 0) return true;

  const direction = e.key === SHORTCUTS.CATEGORY_NEXT ? 1 : -1;

  if (ctx.selectedBinIds.length > 0) {
    const firstBin = findBinById(ctx.layout, ctx.selectedBinIds[0]);
    if (!firstBin) return true;

    const currentPos = categories.findIndex((c) => c.id === firstBin.category);
    const nextPos = (currentPos + direction + categories.length) % categories.length;
    const newCategoryId = categories[nextPos].id;

    const binsToUpdate = findBinsByIds(ctx.layout, ctx.selectedBinIds).filter(
      (bin) => bin.category !== newCategoryId
    );
    if (binsToUpdate.length === 0) return true;

    const batchSize = binsToUpdate.length;
    const newCategory = categories[nextPos];

    ctx.batch(() => {
      for (const bin of binsToUpdate) {
        ctx.updateBin(bin.id, { category: newCategoryId });
      }
    });

    mlTracking.trackCategory(binsToUpdate[0], newCategory.name, batchSize);
  } else {
    const currentIndex = categories.findIndex((c) => c.id === ctx.activeCategoryId);
    const baseIndex =
      currentIndex === -1
        ? direction === 1
          ? 0
          : categories.length - 1
        : (currentIndex + direction + categories.length) % categories.length;
    ctx.setActiveCategory(categories[baseIndex].id);
  }
  return true;
}

export function handleNudge(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  const arrowKeys: readonly string[] = [
    SHORTCUTS.NUDGE_UP,
    SHORTCUTS.NUDGE_DOWN,
    SHORTCUTS.NUDGE_LEFT,
    SHORTCUTS.NUDGE_RIGHT,
  ];
  if (!arrowKeys.includes(e.key)) return false;
  e.preventDefault();

  // Spatial navigation when focused but no selection
  if (ctx.focusedBinId && ctx.selectedBinIds.length === 0) {
    ctx.handleNavigationKey(e.key);
    return true;
  }

  // Nudge selected bins
  if (ctx.selectedBinIds.length === 0) return true;

  const selectedBins = findBinsByIds(ctx.layout, ctx.selectedBinIds);
  const increment = selectedBins.some((bin) => hasFractionalDimensions(bin)) ? 0.5 : 1;

  let dx = 0,
    dy = 0;
  if (e.key === SHORTCUTS.NUDGE_UP) dy = increment;
  if (e.key === SHORTCUTS.NUDGE_DOWN) dy = -increment;
  if (e.key === SHORTCUTS.NUDGE_LEFT) dx = -increment;
  if (e.key === SHORTCUTS.NUDGE_RIGHT) dx = increment;

  // Validate all bins can move
  const excludeIds = new Set(ctx.selectedBinIds);
  let allValid = true;

  for (const binId of ctx.selectedBinIds) {
    const bin = findBinById(ctx.layout, binId);
    if (!bin || bin.layerId === STAGING_ID) {
      allValid = false;
      break;
    }

    const result = canPlaceBin(
      {
        x: (bin.x + dx) as GridUnits,
        y: (bin.y + dy) as GridUnits,
        width: bin.width,
        depth: bin.depth,
        height: bin.height,
      },
      bin.layerId,
      ctx.layout,
      binId,
      excludeIds
    );

    if (!result.valid) {
      allValid = false;
      break;
    }
  }

  if (allValid) {
    const firstBin = selectedBins[0];
    const oldPosition = { x: firstBin.x, y: firstBin.y };
    const newFirstBin = {
      ...firstBin,
      x: (firstBin.x + dx) as GridUnits,
      y: (firstBin.y + dy) as GridUnits,
    };
    mlTracking.trackMove(newFirstBin, oldPosition, 'nudge', selectedBins.length);

    ctx.batch(() => {
      for (const binId of ctx.selectedBinIds) {
        const bin = findBinById(ctx.layout, binId);
        if (!bin) continue;
        ctx.updateBin(binId, { x: (bin.x + dx) as GridUnits, y: (bin.y + dy) as GridUnits });
      }
    });
  }
  return true;
}

// ── Mode Toggles ────────────────────────────────────────────

export function handleToolSwitch(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  const ctrlOrMeta = e.ctrlKey || e.metaKey;
  if (e.key !== SHORTCUTS.TOOL_SWITCH || !e.shiftKey || ctrlOrMeta) return false;
  e.preventDefault();
  ctx.navigateToDesigner();
  return true;
}

export function handleQuickLabel(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  const ctrlOrMeta = e.ctrlKey || e.metaKey;
  if (
    e.key.toLowerCase() !== SHORTCUTS.QUICK_LABEL ||
    ctrlOrMeta ||
    ctx.selectedBinIds.length !== 1
  )
    return false;
  e.preventDefault();
  ctx.showQuickLabel(ctx.selectedBinIds[0]);
  return true;
}

export function handleHalfBinToggle(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  const ctrlOrMeta = e.ctrlKey || e.metaKey;
  if (e.key.toLowerCase() !== SHORTCUTS.HALF_BIN_TOGGLE || ctrlOrMeta) return false;
  e.preventDefault();

  const result = ctx.toggleHalfGridMode();
  if (isErr(result)) {
    const validationResult = validateHalfGridModeToggle(ctx.layout, false);
    if (validationResult.violation) {
      ctx.addToast(
        `Cannot disable half-bin mode: ${validationResult.violation.count} bin${validationResult.violation.count !== 1 ? 's have' : ' has'} fractional dimensions. Move them to staging first.`,
        'error'
      );
    }
  }
  return true;
}
