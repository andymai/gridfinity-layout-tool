import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Popover } from '@/design-system';
import { useTranslation } from '@/i18n';
import { LABEL_ICON_DOMAINS, LABEL_ICON_PATHS } from '@/shared/constants/labelIconPaths';
import type { LabelIconDomain } from '@/shared/constants/labelIconPaths';
import { LABEL_PLATE_ICONS } from '@/shared/constants/labelPlates';
import type { LabelPlateIconId } from '@/shared/constants/labelPlates';
import { LabelIconGlyph } from './LabelIconGlyph';

export interface LabelIconPickerProps {
  readonly value: LabelPlateIconId | null;
  readonly onChange: (icon: LabelPlateIconId | null) => void;
  readonly 'aria-label': string;
}

/**
 * Icon picker for swappable label plates: a grid of the actual silhouettes,
 * grouped by domain and filterable.
 *
 * Replaces a flat `<Select>` of names, which stopped working once the catalog
 * passed a handful of entries — "Wood screw" and "Self-tapping screw" are not
 * distinguishable as words at a glance, but they are as shapes.
 */
export function LabelIconPicker({
  value,
  onChange,
  'aria-label': ariaLabel,
}: LabelIconPickerProps) {
  const t = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const anchorRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Focus the filter on open the way a command palette does. Done in an effect
  // rather than with autoFocus, which fires on mount regardless of visibility.
  useEffect(() => {
    if (isOpen) searchRef.current?.focus();
  }, [isOpen]);

  const label = (icon: LabelPlateIconId): string => t(`binDesigner.plateIcon.${icon}`);

  // Match the localized name as well as the id, so a Swedish user searching
  // "insex" finds the socket cap screw and a contributor searching the id does
  // too.
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = LABEL_PLATE_ICONS.filter(
      (icon) =>
        needle === '' ||
        icon.toLowerCase().includes(needle) ||
        t(`binDesigner.plateIcon.${icon}`).toLowerCase().includes(needle)
    );
    return LABEL_ICON_DOMAINS.map((domain: LabelIconDomain) => ({
      domain,
      icons: matches.filter((icon) => LABEL_ICON_PATHS[icon].domain === domain),
    })).filter((group) => group.icons.length > 0);
  }, [query, t]);

  const close = (): void => {
    setIsOpen(false);
    setQuery('');
  };

  const select = (icon: LabelPlateIconId | null): void => {
    onChange(icon);
    close();
  };

  return (
    <>
      <Button
        ref={anchorRef}
        type="button"
        variant="secondary"
        size="sm"
        className="w-28 shrink-0 justify-start"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        {value ? (
          <>
            <LabelIconGlyph icon={value} size={16} className="shrink-0" />
            <span className="truncate">{label(value)}</span>
          </>
        ) : (
          <span className="truncate text-content-secondary">{t('binDesigner.plateIcon.none')}</span>
        )}
      </Button>

      <Popover
        anchorRef={anchorRef}
        isOpen={isOpen}
        onClose={close}
        className="w-72 rounded-lg border border-stroke-subtle bg-surface-raised p-2 shadow-lg"
      >
        <div role="dialog" aria-label={ariaLabel}>
          <Input
            ref={searchRef}
            size="sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('binDesigner.plateIcon.searchPlaceholder')}
            aria-label={t('binDesigner.plateIcon.searchPlaceholder')}
          />

          <div className="mt-2 max-h-72 overflow-y-auto">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              aria-pressed={value === null}
              onClick={() => select(null)}
            >
              {t('binDesigner.plateIcon.none')}
            </Button>

            {groups.map(({ domain, icons }) => (
              <div key={domain} className="mt-2">
                <p className="px-1 pb-1 text-xs font-medium text-content-tertiary">
                  {t(`binDesigner.plateIcon.group.${domain}`)}
                </p>
                <div className="grid grid-cols-6 gap-1">
                  {icons.map((icon) => (
                    <Button
                      key={icon}
                      type="button"
                      variant={icon === value ? 'primary' : 'ghost'}
                      size="sm"
                      className="h-9 w-full justify-center px-0"
                      aria-pressed={icon === value}
                      aria-label={label(icon)}
                      title={label(icon)}
                      onClick={() => select(icon)}
                    >
                      <LabelIconGlyph icon={icon} size={20} />
                    </Button>
                  ))}
                </div>
              </div>
            ))}

            {groups.length === 0 && (
              <p className="px-1 py-3 text-center text-xs text-content-tertiary">
                {t('binDesigner.plateIcon.noResults')}
              </p>
            )}
          </div>
        </div>
      </Popover>
    </>
  );
}
