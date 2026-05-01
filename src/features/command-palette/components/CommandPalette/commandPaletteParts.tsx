/**
 * Stateless presentational pieces for the Command Palette: the per-category
 * icon and the search-result row.
 */

import { Command } from 'cmdk';
import type { CommandDefinition } from '../../commands';
import { ShortcutBadge } from '../ShortcutBadge';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import type { IconName } from '@/shared/constants/iconPaths';

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

export function CategoryIcon({ category }: { category: string }) {
  // Unknown categories return undefined at runtime even though the index type
  // says `IconName`; render nothing rather than throw when `paths.map()` would
  // otherwise blow up on a missing icon entry.
  const iconName = CATEGORY_ICON_MAP[category] as IconName | undefined;
  if (!iconName) return null;
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

export function CommandItem({ command, onSelect, t }: CommandItemProps) {
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
