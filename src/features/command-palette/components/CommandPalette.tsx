/**
 * Command Palette component using cmdk.
 * Provides quick access to actions and keyboard shortcuts.
 */

import { useCallback, useEffect, useMemo } from 'react';
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
import { COMMAND_DEFINITIONS, CATEGORY_LABELS, CATEGORY_ORDER } from '../commands';
import type { CommandDefinition } from '../commands';
import { useRecentCommandsStore } from '../store/recentStore';
import { ShortcutBadge } from './ShortcutBadge';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const t = useTranslation();

  // Recent commands
  const { recentIds, recordUsage } = useRecentCommandsStore();

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
  } = useSelectionStore(
    useShallow((s) => ({
      selectedBinIds: s.selectedBinIds,
      setSelectedBins: s.setSelectedBins,
      activeLayerId: s.activeLayerId,
      setActiveLayer: s.setActiveLayer,
      showQuickLabel: s.showQuickLabel,
      activeCategoryId: s.activeCategoryId,
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
  const addToast = useToastStore((s) => s.addToast);
  const fillLayerGaps = useLayoutStore((s) => s.fillLayerGaps);
  const { execute } = useUndoableAction();
  const { deleteBin, duplicateBin, updateBin, addLayer } = useMutations();

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
          // Not implemented - requires canvas context
          return null;
        case 'toggle-labels':
          return () => toggleShowLabels();
        case 'toggle-other-layers':
          return () => toggleShowOtherLayers();

        // 3D Preview
        case 'toggle-preview':
          return () => toggleIsometricPreview();
        case 'expand-preview':
          return showIsometricPreview ? () => togglePreviewExpanded() : null;
        case 'camera-isometric':
        case 'camera-top':
        case 'camera-front':
        case 'camera-side':
          // Dispatch event for preview controls to handle
          return showIsometricPreview
            ? () => window.dispatchEvent(new CustomEvent('preview-camera-preset', { detail: id }))
            : null;

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
        case 'next-category':
          // These are more complex - skip for now
          return null;
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
      showIsometricPreview,
      halfBinMode,
      execute,
      deleteBin,
      duplicateBin,
      updateBin,
      addLayer,
      fillLayerGaps,
      setSelectedBins,
      setActiveLayer,
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

  // Build commands with availability
  const commands = useMemo(() => {
    return COMMAND_DEFINITIONS.map((def) => ({
      ...def,
      action: getAction(def.id),
      isAvailable: getAction(def.id) !== null,
    }));
  }, [getAction]);

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

  // Recent commands
  const recentCommands = useMemo(() => {
    return recentIds
      .map((id) => commands.find((c) => c.id === id))
      .filter((c): c is (typeof commands)[number] => c !== undefined && c.isAvailable);
  }, [recentIds, commands]);

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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 animate-fade-in" />

      {/* Palette container - top aligned */}
      <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-full max-w-lg px-4">
        <Command
          className="rounded-xl border border-stroke bg-surface-elevated shadow-2xl overflow-hidden animate-scale-in"
          onClick={(e) => e.stopPropagation()}
          loop
        >
          <Command.Input
            placeholder={t('commandPalette.placeholder')}
            className="w-full px-4 py-3 text-base bg-transparent border-b border-stroke-subtle text-content placeholder:text-content-tertiary focus:outline-none"
            autoFocus
          />

          <Command.List className="max-h-[50vh] overflow-y-auto p-2 scrollbar-thin">
            <Command.Empty className="py-6 text-center text-sm text-content-tertiary">
              {t('commandPalette.noResults')}
            </Command.Empty>

            {/* Recent commands */}
            {recentCommands.length > 0 && (
              <Command.Group
                heading={
                  <span className="text-xs font-medium text-content-tertiary uppercase tracking-wide">
                    {t('commandPalette.recent')}
                  </span>
                }
                className="mb-2"
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

            {/* Grouped commands */}
            {CATEGORY_ORDER.map((category) => {
              const categoryCommands = groupedCommands[category];
              if (!categoryCommands?.length) return null;

              return (
                <Command.Group
                  key={category}
                  heading={
                    <span className="text-xs font-medium text-content-tertiary uppercase tracking-wide">
                      {t(CATEGORY_LABELS[category])}
                    </span>
                  }
                  className="mb-2"
                >
                  {categoryCommands.map((cmd) => (
                    <CommandItem key={cmd.id} command={cmd} onSelect={handleSelect} t={t} />
                  ))}
                </Command.Group>
              );
            })}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

interface CommandItemProps {
  command: CommandDefinition & { action: (() => void) | null; isAvailable: boolean };
  onSelect: (id: string) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

function CommandItem({ command, onSelect, t }: CommandItemProps) {
  return (
    <Command.Item
      value={`${t(command.labelKey)} ${command.keywords?.join(' ') ?? ''}`}
      onSelect={() => onSelect(command.id)}
      disabled={!command.isAvailable}
      className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm text-content data-[selected=true]:bg-accent/10 data-[selected=true]:text-accent data-[disabled=true]:opacity-40 data-[disabled=true]:cursor-not-allowed transition-colors"
    >
      <span>{t(command.labelKey)}</span>
      {command.shortcut && (
        <ShortcutBadge keys={command.shortcut.keys} modifier={command.shortcut.modifier} />
      )}
    </Command.Item>
  );
}
