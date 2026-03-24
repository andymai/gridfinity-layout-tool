/**
 * Command Palette component using cmdk.
 * Provides quick access to actions and keyboard shortcuts.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import { useTranslation } from '@/i18n';
import {
  useLayoutStore,
  useHistoryStore,
  useSelectionStore,
  useViewStore,
  useHalfBinModeStore,
  useInteractionStore,
  useToastStore,
} from '@/core/store';
import { batch } from '@/core/cqrs';
import { useMutations } from '@/shared/contexts';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutSwitcher } from '@/shared/hooks';
import { COMMAND_DEFINITIONS, CATEGORY_LABELS, CATEGORY_ORDER } from '../../commands';
import { getStagingBins, getLayerBins } from '@/shared/utils';
import { findBinById } from '@/shared/utils/entity';

import { useAlignBins } from '@/shared/hooks/useAlignBins';
import { useSelectionActions } from '@/shared/hooks/useSelectionActions';
import { isOk, isErr } from '@/core/result';
import type { BinId } from '@/core/types';
import { binId } from '@/core/types';
import type { CommandDefinition } from '../../commands';
import { useRecentCommandsStore } from '../../store/recentStore';
import { ShortcutBadge } from '../ShortcutBadge';
import { CommandPaletteFooter } from '../CommandPaletteFooter';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import type { IconName } from '@/shared/constants/iconPaths';

type ActionHandler = (() => void) | null;

/** Dispatch a nameless CustomEvent on window */
function dispatchWindowEvent(name: string): void {
  window.dispatchEvent(new CustomEvent(name));
}

/**
 * Builds a map of command ID to action handler (or null if unavailable).
 * Extracted from the component to keep the render body focused on presentation.
 */
function useActionHandlers(): Record<string, ActionHandler> {
  const t = useTranslation();

  const layout = useLayoutStore((s) => s.layout);
  const { undo, redo, canUndo, canRedo } = useHistoryStore(
    useShallow((s) => ({
      undo: s.undo,
      redo: s.redo,
      canUndo: s.canUndo,
      canRedo: s.canRedo,
    }))
  );
  const {
    selectedBinIds,
    setSelectedBins,
    activeLayerId,
    setActiveLayer,
    showQuickLabel,
    activeCategoryId,
    setActiveCategory,
  } = useSelectionStore(
    useShallow((s) => ({
      selectedBinIds: s.selectedBinIds,
      setSelectedBins: s.setSelectedBins,
      activeLayerId: s.activeLayerId,
      setActiveLayer: s.setActiveLayer,
      showQuickLabel: s.showQuickLabel,
      activeCategoryId: s.activeCategoryId,
      setActiveCategory: s.setActiveCategory,
    }))
  );
  const {
    zoomIn,
    zoomOut,
    toggleShowOtherLayers,
    setPrintModalOpen,
    setShowLayoutManager,
    showIsometricPreview,
    toggleIsometricPreview,
    togglePreviewExpanded,
  } = useViewStore(
    useShallow((s) => ({
      zoomIn: s.zoomIn,
      zoomOut: s.zoomOut,
      toggleShowOtherLayers: s.toggleShowOtherLayers,
      setPrintModalOpen: s.setPrintModalOpen,
      setShowLayoutManager: s.setShowLayoutManager,
      showIsometricPreview: s.showIsometricPreview,
      toggleIsometricPreview: s.toggleIsometricPreview,
      togglePreviewExpanded: s.togglePreviewExpanded,
    }))
  );
  const { toggleHalfBinMode, halfBinMode } = useHalfBinModeStore(
    useShallow((s) => ({
      toggleHalfBinMode: s.toggleHalfBinMode,
      halfBinMode: s.halfBinMode,
    }))
  );
  const setInteraction = useInteractionStore((s) => s.setInteraction);
  const paintSize = useInteractionStore((s) => s.paintSize);
  const setPaintSize = useInteractionStore((s) => s.setPaintSize);
  const addToast = useToastStore((s) => s.addToast);
  const { fillLayerGaps, fillLayer } = useLayoutStore(
    useShallow((s) => ({
      fillLayerGaps: s.fillLayerGaps,
      fillLayer: s.fillLayer,
    }))
  );
  const { deleteBin, duplicateBin, updateBin, moveBinToStaging, addLayer } = useMutations();
  const { createNewLayout, duplicateLayout, activeLayoutId } = useLayoutSwitcher();
  const { alignBins } = useAlignBins();
  const { rotateAll, matchHeight } = useSelectionActions();

  return useMemo(() => {
    const hasBinsSelected = selectedBinIds.length > 0;
    const hasSingleBin = selectedBinIds.length === 1;
    const hasMultipleBins = selectedBinIds.length >= 2;
    const layerBins = getLayerBins(layout.bins, activeLayerId);
    const stagingBins = getStagingBins(layout.bins);
    const categories = layout.categories;

    // --- Helpers for repeated patterns ---

    function clearSelection(): void {
      setSelectedBins([]);
      setInteraction(null);
    }

    function cycleBinInLayer(direction: 1 | -1): ActionHandler {
      const sorted = layerBins.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
      if (sorted.length === 0) return null;
      const currentId = selectedBinIds[0];
      const currentIndex = sorted.findIndex((b) => b.id === currentId);
      const nextIndex =
        currentIndex < 0 ? 0 : (currentIndex + direction + sorted.length) % sorted.length;
      return () => setSelectedBins([sorted[nextIndex].id]);
    }

    function cycleCategory(direction: 1 | -1): ActionHandler {
      if (categories.length === 0) return null;

      if (hasBinsSelected) {
        const firstBin = findBinById(layout, selectedBinIds[0]);
        if (!firstBin) return null;

        return () => {
          const currentPos = categories.findIndex((c) => c.id === firstBin.category);
          const nextPos = (currentPos + direction + categories.length) % categories.length;
          const newCategoryId = categories[nextPos].id;

          batch(() => {
            for (const id of selectedBinIds) {
              const result = updateBin(id, { category: newCategoryId });
              if (isErr(result)) break;
            }
          });
          addToast(
            t('toast.categoryChanged', {
              count: selectedBinIds.length,
              name: categories[nextPos].name,
            }),
            'success'
          );
        };
      }

      // No selection: cycle active drawing category
      return () => {
        const currentIndex = categories.findIndex((c) => c.id === activeCategoryId);
        let nextIndex: number;
        if (currentIndex === -1) {
          nextIndex = direction === 1 ? 0 : categories.length - 1;
        } else {
          nextIndex = (currentIndex + direction + categories.length) % categories.length;
        }
        setActiveCategory(categories[nextIndex].id);
      };
    }

    // --- Navigation ---
    const navigation: Record<string, ActionHandler> = {
      'open-layout-manager': () => setShowLayoutManager(true),
      'open-settings': () => dispatchWindowEvent('open-settings-modal'),
      'open-help': () => dispatchWindowEvent('open-help-modal'),
      'open-print': () => setPrintModalOpen(true),
      'send-feedback': () =>
        window.open('https://github.com/andymai/gridfinity-layout-tool/issues', '_blank'),
      'switch-to-designer': () => dispatchWindowEvent('switch-to-designer'),
      'new-layout': () => {
        void createNewLayout();
      },
      'duplicate-layout': activeLayoutId
        ? () => {
            void duplicateLayout(activeLayoutId);
          }
        : null,
    };

    // --- Edit ---
    const rotateBin = (): ActionHandler => {
      if (!hasSingleBin) return null;
      const bin = findBinById(layout, selectedBinIds[0]);
      if (!bin) return null;
      return () => {
        batch(() => {
          const result = updateBin(bin.id, { width: bin.depth, depth: bin.width });
          if (isErr(result)) return;
        });
      };
    };

    const edit: Record<string, ActionHandler> = {
      undo: canUndo ? () => undo() : null,
      redo: canRedo ? () => redo() : null,
      'delete-selected': hasBinsSelected
        ? () => {
            batch(() => {
              for (const id of selectedBinIds) {
                const result = deleteBin(id);
                if (isErr(result)) break;
              }
            });
            // Selection cleanup handled by CQRS selectionPruning subscriber
          }
        : null,
      'duplicate-selected': hasBinsSelected
        ? () => {
            batch(() => {
              const newIds: BinId[] = [];
              for (const id of selectedBinIds) {
                const result = duplicateBin(id);
                if (isOk(result)) {
                  newIds.push(binId(result.value));
                }
              }
              if (newIds.length > 0) {
                setSelectedBins(newIds);
              }
            });
          }
        : null,
      'rotate-bin': rotateBin(),
      'quick-label': hasSingleBin ? () => showQuickLabel(selectedBinIds[0]) : null,
      'clear-selection': () => clearSelection(),
      'align-left': hasMultipleBins ? () => alignBins('left') : null,
      'align-right': hasMultipleBins ? () => alignBins('right') : null,
      'align-top': hasMultipleBins ? () => alignBins('top') : null,
      'align-bottom': hasMultipleBins ? () => alignBins('bottom') : null,
      'rotate-all': hasMultipleBins ? () => rotateAll() : null,
      'match-height': hasMultipleBins ? () => matchHeight() : null,
    };

    // --- Selection ---
    const invertedIds = (() => {
      if (layerBins.length === 0) return [];
      const currentSet = new Set(selectedBinIds);
      return layerBins.filter((b) => !currentSet.has(b.id)).map((b) => b.id);
    })();

    const selectByCategory = (): ActionHandler => {
      if (!hasBinsSelected) return null;
      const firstBin = findBinById(layout, selectedBinIds[0]);
      if (!firstBin) return null;
      const sameCategoryBins = layout.bins
        .filter((b) => b.layerId === activeLayerId && b.category === firstBin.category)
        .map((b) => b.id);
      const category = categories.find((c) => c.id === firstBin.category);
      return () => {
        setSelectedBins(sameCategoryBins);
        addToast(
          t('toast.selectedByCategory', {
            count: sameCategoryBins.length,
            name: category?.name || 'category',
          }),
          'info'
        );
      };
    };

    const selection: Record<string, ActionHandler> = {
      'select-all':
        layerBins.length > 0
          ? () => {
              setSelectedBins(layerBins.map((b) => b.id));
              addToast(t('toast.selectedAll', { count: layerBins.length }), 'info');
            }
          : null,
      'select-none': hasBinsSelected ? () => clearSelection() : null,
      'invert-selection':
        layerBins.length > 0 && invertedIds.length > 0
          ? () => {
              setSelectedBins(invertedIds);
              addToast(t('toast.selectionInverted', { count: invertedIds.length }), 'info');
            }
          : null,
      'select-by-category': selectByCategory(),
    };

    // --- Layers ---
    const currentLayerIndex = layout.layers.findIndex((l) => l.id === activeLayerId);

    const layers: Record<string, ActionHandler> = {
      'add-layer': () => addLayer(),
      'layer-up':
        currentLayerIndex < layout.layers.length - 1
          ? () => setActiveLayer(layout.layers[currentLayerIndex + 1].id)
          : null,
      'layer-down':
        currentLayerIndex > 0
          ? () => setActiveLayer(layout.layers[currentLayerIndex - 1].id)
          : null,
      'clear-layer': () => {
        if (layerBins.length === 0) return;
        batch(() => {
          for (const b of layerBins) {
            const result = deleteBin(b.id);
            if (isErr(result)) break;
          }
        });
      },
    };

    // --- View ---
    const view: Record<string, ActionHandler> = {
      'zoom-in': () => zoomIn(),
      'zoom-out': () => zoomOut(),
      'fit-to-screen': () => dispatchWindowEvent('fit-to-screen'),
      'toggle-other-layers': () => toggleShowOtherLayers(),
    };

    // --- 3D Preview ---
    const preview: Record<string, ActionHandler> = {
      'toggle-preview': () => toggleIsometricPreview(),
      'expand-preview': showIsometricPreview ? () => togglePreviewExpanded() : null,
    };

    // --- Bins ---
    const bins: Record<string, ActionHandler> = {
      'prev-bin': cycleBinInLayer(-1),
      'next-bin': cycleBinInLayer(1),
      'prev-category': cycleCategory(-1),
      'next-category': cycleCategory(1),
      'move-to-stash': hasBinsSelected
        ? () => {
            batch(() => {
              for (const id of selectedBinIds) {
                if (isErr(moveBinToStaging(id))) break;
              }
            });
            addToast(t('toast.movedToStash', { count: selectedBinIds.length }), 'info');
            // Selection cleanup handled by CQRS selectionPruning subscriber
          }
        : null,
      'clear-staging':
        stagingBins.length > 0
          ? () => {
              batch(() => {
                for (const bin of stagingBins) {
                  const result = deleteBin(bin.id);
                  if (isErr(result)) break;
                }
              });
              addToast(t('toast.stagingCleared', { count: stagingBins.length }), 'success');
            }
          : null,
      'restore-from-staging':
        stagingBins.length > 0
          ? () => {
              batch(() => {
                for (const bin of stagingBins) {
                  const result = updateBin(bin.id, { layerId: activeLayerId });
                  if (isErr(result)) break;
                }
              });
              addToast(t('toast.restoredFromStaging', { count: stagingBins.length }), 'success');
            }
          : null,
    };

    // --- Tools ---
    const tools: Record<string, ActionHandler> = {
      'toggle-half-bin': () => {
        const result = toggleHalfBinMode();
        if (!isOk(result)) {
          addToast(t('halfBinBlocked.title'), 'error');
        }
      },
      'fill-gaps': () => fillLayerGaps(activeLayerId, activeCategoryId, halfBinMode),
      'toggle-paint-mode': () => {
        if (paintSize) {
          setPaintSize(null);
        } else {
          setPaintSize({ width: 1, depth: 1 });
          addToast(t('toast.paintModeEnabled'), 'info');
        }
      },
      'fill-layer': () => {
        const count = fillLayer(activeLayerId, 1, 1, activeCategoryId, halfBinMode);
        if (count > 0) {
          addToast(t('toast.layerFilled'), 'success');
        }
      },
    };

    // --- Export ---
    const exportActions: Record<string, ActionHandler> = {
      'download-layout': () => dispatchWindowEvent('download-layout'),
      'copy-share-link': () => dispatchWindowEvent('open-share-modal'),
    };

    return {
      ...navigation,
      ...edit,
      ...selection,
      ...layers,
      ...view,
      ...preview,
      ...bins,
      ...tools,
      ...exportActions,
    };
  }, [
    canUndo,
    canRedo,
    undo,
    redo,
    selectedBinIds,
    layout,
    activeLayerId,
    activeCategoryId,
    activeLayoutId,
    showIsometricPreview,
    halfBinMode,
    paintSize,
    deleteBin,
    duplicateBin,
    updateBin,
    moveBinToStaging,
    addLayer,
    fillLayerGaps,
    fillLayer,
    createNewLayout,
    duplicateLayout,
    setPaintSize,
    setSelectedBins,
    setActiveLayer,
    setActiveCategory,
    setInteraction,
    setShowLayoutManager,
    setPrintModalOpen,
    toggleIsometricPreview,
    togglePreviewExpanded,
    toggleShowOtherLayers,
    showQuickLabel,
    toggleHalfBinMode,
    zoomIn,
    zoomOut,
    alignBins,
    rotateAll,
    matchHeight,
    addToast,
    t,
  ]);
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const t = useTranslation();

  // Frecency tracking
  const recordUsage = useRecentCommandsStore((s) => s.recordUsage);

  // Build all action handlers via extracted hook
  const actionHandlers = useActionHandlers();

  const getAction = useCallback(
    (id: string): ActionHandler => actionHandlers[id] ?? null,
    [actionHandlers]
  );

  // Contextual boost multipliers based on current app state
  const contextBoosts = useContextBoosts();

  // Build commands with availability and boosted scores
  const commands = useMemo(() => {
    const { getFrecencyScore } = useRecentCommandsStore.getState();

    return COMMAND_DEFINITIONS.map((def) => {
      const frecency = getFrecencyScore(def.id);
      const boost = contextBoosts[def.id] ?? 1.0;
      const action = getAction(def.id);
      return {
        ...def,
        action,
        isAvailable: action !== null,
        effectiveScore: frecency * boost,
      };
    });
  }, [getAction, contextBoosts]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, typeof commands> = {};
    for (const cmd of commands) {
      const cat = cmd.category;
      (groups[cat] ??= []).push(cmd);
    }
    return groups;
  }, [commands]);

  // Frecent commands (combines frequency + recency + context)
  const recentCommands = useMemo(() => {
    return commands
      .filter((c) => c.isAvailable && c.effectiveScore > 0.01)
      .sort((a, b) => b.effectiveScore - a.effectiveScore)
      .slice(0, 5);
  }, [commands]);

  // IDs of commands shown in recent section (to avoid duplicates)
  const recentCommandIds = useMemo(
    () => new Set(recentCommands.map((c) => c.id)),
    [recentCommands]
  );

  // Track currently highlighted command for footer display
  const [selectedCommandId, setSelectedCommandId] = useState<string | null>(null);
  const selectedCommand = useMemo(
    () => commands.find((c) => c.id === selectedCommandId) ?? null,
    [commands, selectedCommandId]
  );

  // Handle command selection
  const handleSelect = useCallback(
    (id: string) => {
      const cmd = commands.find((c) => c.id === id);
      if (cmd?.action) {
        recordUsage(id);
        onOpenChange(false);
        // Execute after closing to avoid focus issues
        requestAnimationFrame(() => {
          cmd.action?.();
        });
      }
    },
    [commands, recordUsage, onOpenChange]
  );

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]" role="presentation" onClick={() => onOpenChange(false)}>
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-fade-in" />

      {/* Palette container - top aligned like Spotlight */}
      <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-full max-w-[560px] px-4">
        <Command
          className="rounded-xl border border-stroke bg-surface-secondary shadow-xl animate-scale-in overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          loop
          onValueChange={(value) => {
            // Extract command ID from composite value (id::label keywords)
            const commandId = value.split('::')[0];
            setSelectedCommandId(commandId);
          }}
        >
          {/* Search input with icon */}
          <div className="flex items-center gap-3 px-4 border-b border-stroke-subtle bg-surface-secondary">
            <svg
              className="w-4 h-4 text-content-tertiary shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              {ICON_PATHS.search.map((d) => (
                <path key={d} strokeLinecap="round" strokeLinejoin="round" d={d} />
              ))}
            </svg>
            <Command.Input
              placeholder={t('commandPalette.placeholder')}
              className="flex-1 py-3.5 text-[15px] bg-transparent text-content placeholder:text-content-tertiary outline-none"
              // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional autofocus for modal/dialog UX
              autoFocus
            />
            <kbd className="hidden sm:inline-flex items-center justify-center min-w-[28px] h-[22px] px-1.5 text-[11px] font-mono font-medium rounded border border-stroke bg-gradient-to-b from-surface-elevated to-surface text-content-secondary shadow-[0_1px_0_1px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.05)]">
              esc
            </kbd>
          </div>

          <Command.List className="max-h-[50vh] overflow-y-auto overflow-x-hidden py-2 scrollbar-thin">
            <Command.Empty className="py-10 text-center">
              <div className="flex flex-col items-center gap-2 text-content-tertiary">
                <div className="w-10 h-10 rounded-lg bg-surface-hover flex items-center justify-center">
                  <svg
                    className="w-5 h-5 opacity-60"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    {ICON_PATHS.questionCircle.map((d) => (
                      <path key={d} strokeLinecap="round" strokeLinejoin="round" d={d} />
                    ))}
                  </svg>
                </div>
                <p className="text-sm text-content-secondary">{t('commandPalette.noResults')}</p>
              </div>
            </Command.Empty>

            {/* Recent commands */}
            {recentCommands.length > 0 && (
              <Command.Group
                heading={
                  <div className="flex items-center gap-1.5 px-3 pb-1.5 pt-1">
                    <svg
                      className="w-3 h-3 text-content-tertiary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      {ICON_PATHS.clock.map((d) => (
                        <path key={d} strokeLinecap="round" strokeLinejoin="round" d={d} />
                      ))}
                    </svg>
                    <span className="text-[10px] font-semibold text-content-tertiary uppercase tracking-wider">
                      {t('commandPalette.recent')}
                    </span>
                  </div>
                }
                className="mb-0.5"
              >
                {recentCommands.map((cmd) => (
                  <CommandItem
                    key={`recent-${cmd.id}`}
                    command={cmd}
                    onSelect={handleSelect}
                    t={t}
                  />
                ))}
              </Command.Group>
            )}

            {/* Grouped commands (excluding ones already in Recent) */}
            {CATEGORY_ORDER.map((category) => {
              const categoryCommands = groupedCommands[category].filter(
                (cmd) => !recentCommandIds.has(cmd.id)
              );
              if (!categoryCommands.length) return null;

              return (
                <Command.Group
                  key={category}
                  heading={
                    <div className="flex items-center gap-1.5 px-3 pb-1.5 pt-2.5 first:pt-1">
                      <CategoryIcon category={category} />
                      <span className="text-[10px] font-semibold text-content-tertiary uppercase tracking-wider">
                        {t(CATEGORY_LABELS[category])}
                      </span>
                    </div>
                  }
                  className="mb-0.5"
                >
                  {categoryCommands.map((cmd) => (
                    <CommandItem key={cmd.id} command={cmd} onSelect={handleSelect} t={t} />
                  ))}
                </Command.Group>
              );
            })}
          </Command.List>

          {/* Footer with keyboard hints */}
          <CommandPaletteFooter selectedCommand={selectedCommand} matchCount={commands.length} />
        </Command>
      </div>
    </div>
  );
}

/**
 * Contextual boost multipliers based on current app state.
 * Extracted to keep the component body focused.
 */
function useContextBoosts(): Record<string, number> {
  const selectedBinIds = useSelectionStore((s) => s.selectedBinIds);
  const layout = useLayoutStore((s) => s.layout);
  const activeLayerId = useSelectionStore((s) => s.activeLayerId);
  const showIsometricPreview = useViewStore((s) => s.showIsometricPreview);
  const { canUndo, canRedo } = useHistoryStore(
    useShallow((s) => ({ canUndo: s.canUndo, canRedo: s.canRedo }))
  );
  const paintSize = useInteractionStore((s) => s.paintSize);

  return useMemo(() => {
    const hasBinsSelected = selectedBinIds.length > 0;
    const hasSingleBin = selectedBinIds.length === 1;
    const hasMultipleBins = selectedBinIds.length >= 2;
    const hasMultipleLayers = layout.layers.length > 1;
    const hasLayerBins = layout.bins.some((b) => b.layerId === activeLayerId);
    const hasStagingBins = getStagingBins(layout.bins).length > 0;

    return {
      // Edit commands - boost when bins selected
      'delete-selected': hasBinsSelected ? 2.0 : 0.4,
      'duplicate-selected': hasBinsSelected ? 2.0 : 0.4,
      'rotate-bin': hasSingleBin ? 2.0 : 0.3,
      'quick-label': hasSingleBin ? 1.8 : 0.4,
      'clear-selection': hasBinsSelected ? 1.5 : 0.3,
      'align-left': hasMultipleBins ? 2.0 : 0.3,
      'align-right': hasMultipleBins ? 2.0 : 0.3,
      'align-top': hasMultipleBins ? 2.0 : 0.3,
      'align-bottom': hasMultipleBins ? 2.0 : 0.3,
      'rotate-all': hasMultipleBins ? 2.0 : 0.3,
      'match-height': hasMultipleBins ? 2.0 : 0.3,
      'move-to-stash': hasBinsSelected ? 1.8 : 0.4,

      // Layer commands - boost when multiple layers
      'layer-up': hasMultipleLayers ? 1.5 : 0.5,
      'layer-down': hasMultipleLayers ? 1.5 : 0.5,
      'add-layer': layout.layers.length < 10 ? 1.3 : 0.5,
      'clear-layer': hasLayerBins ? 1.5 : 0.3,

      // 3D preview commands - boost when preview visible
      'expand-preview': showIsometricPreview ? 1.8 : 0.3,
      'toggle-preview': showIsometricPreview ? 1.0 : 1.5,

      // Undo/redo - boost when available
      undo: canUndo ? 1.5 : 0.3,
      redo: canRedo ? 1.5 : 0.3,

      // Category navigation - boost when bins selected
      'prev-category': hasBinsSelected ? 1.8 : 0.8,
      'next-category': hasBinsSelected ? 1.8 : 0.8,

      // Selection - boost select-all when no selection, select-none when selection exists
      'select-all': hasBinsSelected ? 0.5 : 1.8,
      'select-none': hasBinsSelected ? 1.5 : 0.3,

      // Paint mode - boost when not in paint mode
      'toggle-paint-mode': paintSize ? 1.2 : 1.5,

      // Fill operations - boost when layer has space
      'fill-layer': hasLayerBins ? 0.8 : 1.8,
      'fill-gaps': hasLayerBins ? 1.5 : 0.5,

      // Staging operations - boost when staging has bins
      'clear-staging': hasStagingBins ? 1.8 : 0.3,
      'restore-from-staging': hasStagingBins ? 2.0 : 0.3,

      // Advanced selection - boost when bins selected
      'invert-selection': hasLayerBins ? 1.5 : 0.3,
      'select-by-category': hasBinsSelected ? 1.8 : 0.3,
    };
  }, [
    selectedBinIds.length,
    layout.layers.length,
    layout.bins,
    activeLayerId,
    showIsometricPreview,
    canUndo,
    canRedo,
    paintSize,
  ]);
}

const CATEGORY_ICON_MAP: Record<string, IconName> = {
  navigation: 'home',
  edit: 'edit',
  layers: 'layers',
  view: 'eye',
  preview: '3dPreview',
  bins: 'cube',
  tools: 'settings',
  export: 'upload',
};

function CategoryIcon({ category }: { category: string }) {
  const iconName = CATEGORY_ICON_MAP[category];
  const paths = ICON_PATHS[iconName];

  return (
    <svg
      className="w-3 h-3 text-content-tertiary"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      {paths.map((d) => (
        <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
      ))}
    </svg>
  );
}

interface CommandItemProps {
  command: CommandDefinition & { action: (() => void) | null; isAvailable: boolean };
  onSelect: (id: string) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

function CommandItem({ command, onSelect, t }: CommandItemProps) {
  // Use composite value: id::searchable_text for robust matching
  const searchValue = `${command.id}::${t(command.labelKey)} ${command.keywords?.join(' ') ?? ''}`;

  return (
    <Command.Item
      value={searchValue}
      onSelect={() => onSelect(command.id)}
      disabled={!command.isAvailable}
      className="group flex items-center justify-between gap-3 mx-2 px-2.5 py-2 rounded-lg cursor-pointer text-[13px] text-content transition-colors data-[selected=true]:bg-accent/10 data-[selected=true]:text-accent data-[disabled=true]:opacity-35 data-[disabled=true]:cursor-not-allowed focus-visible:outline-none"
    >
      <span className="truncate">{t(command.labelKey)}</span>
      {command.shortcut && (
        <ShortcutBadge
          keys={command.shortcut.keys}
          modifier={command.shortcut.modifier}
          shift={command.shortcut.shift}
          className="opacity-50 group-data-[selected=true]:opacity-90 transition-opacity shrink-0"
        />
      )}
    </Command.Item>
  );
}
