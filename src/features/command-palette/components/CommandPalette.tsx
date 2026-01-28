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
  useLibraryStore,
  useInteractionStore,
  useToastStore,
  useUndoableAction,
} from '@/core/store';
import { useMutations } from '@/shared/contexts';
import { useShallow } from 'zustand/shallow';
import { useLayoutSwitcher } from '@/hooks';
import { COMMAND_DEFINITIONS, CATEGORY_LABELS, CATEGORY_ORDER } from '../commands';
import { STAGING_ID } from '@/core/constants';
import type { CommandDefinition } from '../commands';
import { useRecentCommandsStore } from '../store/recentStore';
import { ShortcutBadge } from './ShortcutBadge';
import { CommandPaletteFooter } from './CommandPaletteFooter';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const t = useTranslation();

  // Frecency tracking
  const { recordUsage } = useRecentCommandsStore();

  // Stores
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
  const { zoomIn, zoomOut, toggleShowLabels, toggleShowOtherLayers, setPrintModalOpen } =
    useViewStore(
      useShallow((s) => ({
        zoomIn: s.zoomIn,
        zoomOut: s.zoomOut,
        toggleShowLabels: s.toggleShowLabels,
        toggleShowOtherLayers: s.toggleShowOtherLayers,
        setPrintModalOpen: s.setPrintModalOpen,
      }))
    );
  const { toggleHalfBinMode, halfBinMode } = useHalfBinModeStore(
    useShallow((s) => ({
      toggleHalfBinMode: s.toggleHalfBinMode,
      halfBinMode: s.halfBinMode,
    }))
  );
  const setShowLayoutManager = useLibraryStore((s) => s.setShowLayoutManager);
  const { showIsometricPreview, toggleIsometricPreview, togglePreviewExpanded } =
    useInteractionStore(
      useShallow((s) => ({
        showIsometricPreview: s.showIsometricPreview,
        toggleIsometricPreview: s.toggleIsometricPreview,
        togglePreviewExpanded: s.togglePreviewExpanded,
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
  const { execute } = useUndoableAction();
  const { deleteBin, duplicateBin, updateBin, addLayer } = useMutations();

  // Layout management
  const { createNewLayout, duplicateLayout, activeLayoutId } = useLayoutSwitcher();

  // Build action handlers
  const getAction = useCallback(
    (id: string): (() => void) | null => {
      switch (id) {
        // Navigation
        case 'open-layout-manager':
          return () => setShowLayoutManager(true);
        case 'open-settings':
          return () => window.dispatchEvent(new CustomEvent('open-settings-modal'));
        case 'open-help':
          // Dispatch custom event to open help modal (handled in App.tsx)
          return () => window.dispatchEvent(new CustomEvent('open-help-modal'));
        case 'open-print':
          return () => setPrintModalOpen(true);
        case 'switch-to-designer':
          return () => window.dispatchEvent(new CustomEvent('switch-to-designer'));

        // Edit
        case 'undo':
          return canUndo ? () => undo() : null;
        case 'redo':
          return canRedo ? () => redo() : null;
        case 'delete-selected':
          return selectedBinIds.length > 0
            ? () => {
                execute(() => {
                  for (const binId of selectedBinIds) {
                    deleteBin(binId);
                  }
                });
                setSelectedBins([]);
              }
            : null;
        case 'duplicate-selected':
          return selectedBinIds.length > 0
            ? () => {
                execute(() => {
                  const newIds: string[] = [];
                  for (const binId of selectedBinIds) {
                    const result = duplicateBin(binId);
                    if (result && 'value' in result) {
                      newIds.push(result.value);
                    }
                  }
                  if (newIds.length > 0) {
                    setSelectedBins(newIds);
                  }
                });
              }
            : null;
        case 'rotate-bin': {
          if (selectedBinIds.length !== 1) return null;
          const bin = layout.bins.find((b) => b.id === selectedBinIds[0]);
          if (!bin) return null;
          return () => {
            execute(() => {
              updateBin(bin.id, { width: bin.depth, depth: bin.width });
            });
          };
        }
        case 'quick-label':
          return selectedBinIds.length === 1 ? () => showQuickLabel(selectedBinIds[0]) : null;
        case 'clear-selection':
          return () => {
            setSelectedBins([]);
            setInteraction(null);
          };

        // Layers
        case 'add-layer':
          return () => addLayer();
        case 'layer-up': {
          const currentIndex = layout.layers.findIndex((l) => l.id === activeLayerId);
          if (currentIndex < layout.layers.length - 1) {
            return () => setActiveLayer(layout.layers[currentIndex + 1].id);
          }
          return null;
        }
        case 'layer-down': {
          const currentIndex = layout.layers.findIndex((l) => l.id === activeLayerId);
          if (currentIndex > 0) {
            return () => setActiveLayer(layout.layers[currentIndex - 1].id);
          }
          return null;
        }
        case 'clear-layer':
          return () => {
            const layerBins = layout.bins.filter((b) => b.layerId === activeLayerId);
            if (layerBins.length === 0) return;
            execute(() => {
              for (const b of layerBins) {
                deleteBin(b.id);
              }
            });
          };

        // View
        case 'zoom-in':
          return () => zoomIn();
        case 'zoom-out':
          return () => zoomOut();
        case 'fit-to-screen':
          return () => window.dispatchEvent(new CustomEvent('fit-to-screen'));
        case 'toggle-labels':
          return () => toggleShowLabels();
        case 'toggle-other-layers':
          return () => toggleShowOtherLayers();

        // 3D Preview
        case 'toggle-preview':
          return () => toggleIsometricPreview();
        case 'expand-preview':
          return showIsometricPreview ? () => togglePreviewExpanded() : null;

        // Bins
        case 'prev-bin':
        case 'next-bin': {
          const layerBins = layout.bins
            .filter((b) => b.layerId === activeLayerId)
            .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
          if (layerBins.length === 0) return null;
          const currentId = selectedBinIds[0];
          const currentIndex = layerBins.findIndex((b) => b.id === currentId);
          const direction = id === 'next-bin' ? 1 : -1;
          const nextIndex =
            currentIndex < 0 ? 0 : (currentIndex + direction + layerBins.length) % layerBins.length;
          return () => setSelectedBins([layerBins[nextIndex].id]);
        }
        case 'prev-category':
        case 'next-category': {
          const categories = layout.categories;
          if (categories.length === 0) return null;

          const direction = id === 'next-category' ? 1 : -1;

          if (selectedBinIds.length > 0) {
            // Cycle category of selected bins
            const firstBin = layout.bins.find((b) => b.id === selectedBinIds[0]);
            if (!firstBin) return null;

            return () => {
              const currentPos = categories.findIndex((c) => c.id === firstBin.category);
              const nextPos = (currentPos + direction + categories.length) % categories.length;
              const newCategoryId = categories[nextPos].id;

              execute(() => {
                for (const binId of selectedBinIds) {
                  updateBin(binId, { category: newCategoryId });
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
          } else {
            // Cycle active drawing category
            return () => {
              const currentIndex = categories.findIndex((c) => c.id === activeCategoryId);
              const nextIndex =
                currentIndex === -1
                  ? direction === 1
                    ? 0
                    : categories.length - 1
                  : (currentIndex + direction + categories.length) % categories.length;
              setActiveCategory(categories[nextIndex].id);
            };
          }
        }
        case 'move-to-stash':
          return selectedBinIds.length > 0
            ? () => {
                execute(() => {
                  for (const binId of selectedBinIds) {
                    updateBin(binId, { layerId: '__staging__' });
                  }
                });
                addToast(t('toast.movedToStash', { count: selectedBinIds.length }), 'info');
                setSelectedBins([]);
              }
            : null;

        // Tools
        case 'toggle-half-bin':
          return () => {
            const result = toggleHalfBinMode();
            if (!result.success) {
              addToast(t('halfBinBlocked.title'), 'error');
            }
          };
        case 'fill-gaps':
          return () => fillLayerGaps(activeLayerId, activeCategoryId, halfBinMode);

        // Export
        case 'download-layout':
          return () => window.dispatchEvent(new CustomEvent('download-layout'));
        case 'copy-share-link':
          return () => window.dispatchEvent(new CustomEvent('open-share-modal'));

        // Name suggestions
        case 'suggest-layout-name':
          return () => window.dispatchEvent(new CustomEvent('trigger-name-suggestions'));
        // Selection
        case 'select-all': {
          const layerBins = layout.bins.filter((b) => b.layerId === activeLayerId);
          return layerBins.length > 0
            ? () => {
                setSelectedBins(layerBins.map((b) => b.id));
                addToast(t('toast.selectedAll', { count: layerBins.length }), 'info');
              }
            : null;
        }
        case 'select-none':
          return selectedBinIds.length > 0
            ? () => {
                setSelectedBins([]);
                setInteraction(null);
              }
            : null;
        case 'invert-selection': {
          const layerBins = layout.bins.filter((b) => b.layerId === activeLayerId);
          if (layerBins.length === 0) return null;
          const currentSet = new Set(selectedBinIds);
          const invertedIds = layerBins.filter((b) => !currentSet.has(b.id)).map((b) => b.id);
          return invertedIds.length > 0
            ? () => {
                setSelectedBins(invertedIds);
                addToast(t('toast.selectionInverted', { count: invertedIds.length }), 'info');
              }
            : null;
        }
        case 'select-by-category': {
          if (selectedBinIds.length === 0) return null;
          const firstBin = layout.bins.find((b) => b.id === selectedBinIds[0]);
          if (!firstBin) return null;
          const sameCategoryBins = layout.bins
            .filter((b) => b.layerId === activeLayerId && b.category === firstBin.category)
            .map((b) => b.id);
          const category = layout.categories.find((c) => c.id === firstBin.category);
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
        }

        // Layout management
        case 'new-layout':
          return () => {
            createNewLayout();
          };
        case 'duplicate-layout':
          return activeLayoutId
            ? () => {
                duplicateLayout(activeLayoutId);
              }
            : null;

        // Tools (extended)
        case 'toggle-paint-mode':
          return () => {
            if (paintSize) {
              setPaintSize(null);
            } else {
              // Default to 1x1 paint size
              setPaintSize({ width: 1, depth: 1 });
              addToast(t('toast.paintModeEnabled'), 'info');
            }
          };
        case 'fill-layer':
          return () => {
            // Fill with 1x1 bins as the default uniform size
            const count = fillLayer(activeLayerId, 1, 1, activeCategoryId, halfBinMode);
            if (count > 0) {
              addToast(t('toast.layerFilled'), 'success');
            }
          };

        // Staging
        case 'clear-staging': {
          const stagingBins = layout.bins.filter((b) => b.layerId === STAGING_ID);
          return stagingBins.length > 0
            ? () => {
                execute(() => {
                  for (const bin of stagingBins) {
                    deleteBin(bin.id);
                  }
                });
                addToast(t('toast.stagingCleared', { count: stagingBins.length }), 'success');
              }
            : null;
        }
        case 'restore-from-staging': {
          const stagingBins = layout.bins.filter((b) => b.layerId === STAGING_ID);
          return stagingBins.length > 0
            ? () => {
                execute(() => {
                  for (const bin of stagingBins) {
                    updateBin(bin.id, { layerId: activeLayerId });
                  }
                });
                addToast(t('toast.restoredFromStaging', { count: stagingBins.length }), 'success');
              }
            : null;
        }

        default:
          return null;
      }
    },
    [
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
      execute,
      deleteBin,
      duplicateBin,
      updateBin,
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
      toggleShowLabels,
      toggleShowOtherLayers,
      showQuickLabel,
      toggleHalfBinMode,
      zoomIn,
      zoomOut,
      addToast,
      t,
    ]
  );

  // Contextual boost multipliers based on current app state
  const contextBoosts = useMemo(() => {
    const hasBinsSelected = selectedBinIds.length > 0;
    const hasSingleBin = selectedBinIds.length === 1;
    const hasMultipleLayers = layout.layers.length > 1;
    const hasLayerBins = layout.bins.some((b) => b.layerId === activeLayerId);
    const hasStagingBins = layout.bins.some((b) => b.layerId === STAGING_ID);

    // Returns multiplier: >1 = boosted, <1 = demoted, 1 = neutral
    const boosts: Record<string, number> = {
      // Edit commands - boost when bins selected
      'delete-selected': hasBinsSelected ? 2.0 : 0.4,
      'duplicate-selected': hasBinsSelected ? 2.0 : 0.4,
      'rotate-bin': hasSingleBin ? 2.0 : 0.3,
      'quick-label': hasSingleBin ? 1.8 : 0.4,
      'clear-selection': hasBinsSelected ? 1.5 : 0.3,
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

    return boosts;
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
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
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
    <div className="fixed inset-0 z-[100]" onClick={() => onOpenChange(false)}>
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
            const commandId = value?.split('::')[0] ?? null;
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <Command.Input
              placeholder={t('commandPalette.placeholder')}
              className="flex-1 py-3.5 text-[15px] bg-transparent text-content placeholder:text-content-tertiary outline-none"
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
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
                    />
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
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
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
              const categoryCommands = groupedCommands[category]?.filter(
                (cmd) => !recentCommandIds.has(cmd.id)
              );
              if (!categoryCommands?.length) return null;

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

/** Category icons for visual distinction */
function CategoryIcon({ category }: { category: string }) {
  const iconClass = 'w-3 h-3 text-content-tertiary';

  switch (category) {
    case 'navigation':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      );
    case 'edit':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      );
    case 'layers':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      );
    case 'view':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
      );
    case 'preview':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"
          />
        </svg>
      );
    case 'bins':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      );
    case 'tools':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      );
    case 'export':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
      );
    default:
      return null;
  }
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
