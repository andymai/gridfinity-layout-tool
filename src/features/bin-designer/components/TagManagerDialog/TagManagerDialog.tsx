import { useState } from 'react';
import { Dialog, Button, IconButton, ColorSwatch, XIcon } from '@/design-system';
import { useTranslation } from '@/i18n';
import { CATEGORY_COLOR_PALETTE } from '@/core/constants';
import {
  TAG_ICONS,
  tagAppearanceKey,
  tagTint,
  useTagAppearanceStore,
} from '../../store/tagAppearance';
import { TagGlyph } from '../TagGlyph';

interface TagManagerDialogProps {
  open: boolean;
  /** Every tag currently in use across saved designs (already deduped/sorted). */
  tags: readonly string[];
  onClose: () => void;
}

/**
 * Global tag manager: assign an icon and/or color to any tag in use. Appearance
 * applies everywhere the tag renders (chips, filter bar, suggestions) and is
 * keyed case-insensitively, so "Kitchen" and "kitchen" share one look.
 */
export function TagManagerDialog({ open, tags, onClose }: TagManagerDialogProps) {
  const t = useTranslation();
  const appearances = useTagAppearanceStore((s) => s.appearances);
  const setTagAppearance = useTagAppearanceStore((s) => s.setTagAppearance);
  const clearTagAppearance = useTagAppearanceStore((s) => s.clearTagAppearance);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (!open) return null;

  return (
    <Dialog.Root open={open} onClose={onClose} size="md">
      <Dialog.Header
        title={t('binDesigner.tagManager.title')}
        closeAriaLabel={t('common.closeDialog')}
      />
      <Dialog.Body>
        {tags.length === 0 ? (
          <p className="py-6 text-center text-sm text-content-tertiary">
            {t('binDesigner.tagManager.empty')}
          </p>
        ) : (
          <ul className="space-y-1">
            {tags.map((tag) => {
              const key = tagAppearanceKey(tag);
              const appearance = appearances[key];
              const expanded = expandedKey === key;
              return (
                <li key={key} className="rounded-lg border border-stroke-subtle">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setExpandedKey(expanded ? null : key)}
                      aria-expanded={expanded}
                      aria-label={t('binDesigner.tagManager.customize', { tag })}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated px-2.5 py-0.5 text-xs font-medium text-content"
                        style={
                          appearance?.color !== undefined
                            ? { backgroundColor: tagTint(appearance.color) }
                            : undefined
                        }
                      >
                        <TagGlyph appearance={appearance} />
                        <span className="max-w-[12rem] truncate" title={tag}>
                          {tag}
                        </span>
                      </span>
                      <svg
                        className={`h-4 w-4 flex-shrink-0 text-content-tertiary transition-transform ${expanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    {appearance !== undefined && (
                      <IconButton
                        type="button"
                        size="sm"
                        touchTarget={false}
                        onClick={() => clearTagAppearance(tag)}
                        className="h-auto w-auto rounded-full p-1 text-content-tertiary hover:bg-surface-hover hover:text-content"
                        aria-label={t('binDesigner.tagManager.clear', { tag })}
                        title={t('binDesigner.tagManager.clear', { tag })}
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </IconButton>
                    )}
                  </div>
                  {expanded && (
                    <div className="space-y-3 border-t border-stroke-subtle px-3 py-3">
                      <div>
                        <p className="mb-1.5 text-xs font-medium text-content-tertiary">
                          {t('binDesigner.tagManager.iconLabel')}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setTagAppearance(tag, { icon: null })}
                            aria-pressed={appearance?.icon === undefined}
                            className={`rounded-md border px-2 py-1 text-xs font-medium ${
                              appearance?.icon === undefined
                                ? 'border-accent text-content'
                                : 'border-stroke text-content-secondary hover:bg-surface-hover'
                            }`}
                          >
                            {t('binDesigner.tagManager.none')}
                          </Button>
                          {TAG_ICONS.map((icon) => (
                            <IconButton
                              key={icon}
                              type="button"
                              size="sm"
                              touchTarget={false}
                              onClick={() => setTagAppearance(tag, { icon })}
                              pressed={appearance?.icon === icon}
                              aria-label={t('binDesigner.tagManager.setIcon', { icon, tag })}
                              className={`h-7 w-7 rounded-md border text-sm ${
                                appearance?.icon === icon
                                  ? 'border-accent bg-surface-elevated'
                                  : 'border-transparent hover:bg-surface-hover'
                              }`}
                            >
                              <span aria-hidden="true">{icon}</span>
                            </IconButton>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1.5 text-xs font-medium text-content-tertiary">
                          {t('binDesigner.tagManager.colorLabel')}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setTagAppearance(tag, { color: null })}
                            aria-pressed={appearance?.color === undefined}
                            className={`rounded-md border px-2 py-1 text-xs font-medium ${
                              appearance?.color === undefined
                                ? 'border-accent text-content'
                                : 'border-stroke text-content-secondary hover:bg-surface-hover'
                            }`}
                          >
                            {t('binDesigner.tagManager.none')}
                          </Button>
                          {CATEGORY_COLOR_PALETTE.map(({ color, nameKey }) => {
                            const name = t(nameKey);
                            const selected = appearance?.color === color;
                            return (
                              <IconButton
                                key={color}
                                type="button"
                                size="sm"
                                touchTarget={false}
                                onClick={() => setTagAppearance(tag, { color })}
                                pressed={selected}
                                aria-label={t('binDesigner.tagManager.setColor', { name, tag })}
                                title={name}
                                className="h-6 w-6 hover:scale-110 hover:bg-transparent"
                                style={{
                                  boxShadow: selected
                                    ? '0 0 0 2px var(--color-primary)'
                                    : 'var(--shadow-sm)',
                                }}
                              >
                                <ColorSwatch
                                  color={color}
                                  shape="square"
                                  className="h-full w-full"
                                />
                              </IconButton>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="primary" onClick={onClose}>
          {t('common.close')}
        </Button>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
