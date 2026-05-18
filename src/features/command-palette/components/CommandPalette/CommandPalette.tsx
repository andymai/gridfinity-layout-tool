/**
 * Command Palette component using cmdk.
 * Provides quick access to actions and keyboard shortcuts.
 *
 * The render body composes commands from `COMMAND_DEFINITIONS` with their
 * action handlers and contextual boost scores; both are computed in sibling
 * hooks to keep this file focused on presentation.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import { useTranslation } from '@/i18n';
import { COMMAND_DEFINITIONS, CATEGORY_LABELS, CATEGORY_ORDER } from '../../commands';
import { useRecentCommandsStore } from '../../store/recentStore';
import { CommandPaletteFooter } from '../CommandPaletteFooter';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { useActionHandlers, type ActionHandler } from './commandPaletteActionHandlers';
import { useContextBoosts } from './commandPaletteContextBoosts';
import { CategoryIcon, CommandItem } from './commandPaletteParts';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Optional initial query to seed the search input when the palette opens.
   * Used by the Help modal's empty-state fall-through so users land here with
   * their query already typed.
   */
  initialQuery?: string;
}

export function CommandPalette({ open, onOpenChange, initialQuery = '' }: CommandPaletteProps) {
  const t = useTranslation();
  // App.tsx unmounts this component when closed (`{commandPaletteOpen && <CommandPalette/>}`),
  // so the initial state runs fresh on every open — no need to re-seed via effect.
  const [searchValue, setSearchValue] = useState(initialQuery);

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
              value={searchValue}
              onValueChange={setSearchValue}
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
