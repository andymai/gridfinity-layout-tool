import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLayoutSwitcher } from '@/shared/hooks';
import { useLayoutStore } from '@/core/store';
import { computePreview } from '@/core/storage';
import { LayoutThumbnail } from '@/shell/LayoutThumbnail';
import type { LayoutPreview } from '@/core/types';
import { layoutId } from '@/core/types';
import { useTranslation } from '@/i18n';
import { Button } from '@/design-system';

interface LayoutQuickSwitchProps {
  onManage: () => void;
}

const ICON: Record<'chevron' | 'check' | 'plus' | 'gear', string[]> = {
  chevron: ['M19 9l-7 7-7-7'],
  check: ['M5 13l4 4L19 7'],
  plus: ['M12 4v16m8-8H4'],
  gear: [
    'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
    'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  ],
};

interface IconProps {
  name: keyof typeof ICON;
  className: string;
}

function Icon({ name, className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      {ICON[name].map((d) => (
        <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
      ))}
    </svg>
  );
}

interface ThumbProps {
  preview: LayoutPreview;
  size: number;
  className: string;
}

function Thumb({ preview, size, className }: ThumbProps) {
  return (
    <span
      className={`flex items-center justify-center overflow-hidden rounded border border-stroke-subtle bg-surface ${className}`}
    >
      <LayoutThumbnail preview={preview} size={size} className="max-h-full max-w-full" />
    </span>
  );
}

const MENU_ITEM_CLASS =
  'w-full justify-start gap-2 rounded-none px-2.5 py-2 text-left text-sm font-normal text-content-secondary hover:bg-surface-hover hover:text-content';

interface MenuActionProps {
  onClick: () => void;
  children: ReactNode;
}

function MenuAction({ onClick, children }: MenuActionProps) {
  return (
    <Button variant="ghost" fullWidth role="menuitem" onClick={onClick} className={MENU_ITEM_CLASS}>
      {children}
    </Button>
  );
}

// Layouts are recognized by shape, so the trigger leads with the active
// layout's thumbnail rather than its name; management lives behind "Manage…".
export function LayoutQuickSwitch({ onManage }: LayoutQuickSwitchProps) {
  const t = useTranslation();
  const { activeLayoutId, library, switchLayout, createNewLayout } = useLayoutSwitcher();
  const currentLayout = useLayoutStore((s) => s.layout);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // In shared-preview / embed mode the active layout isn't a library entry, so
  // the trigger reflects the live layout store instead of mislabeling itself
  // with entries[0].
  const activeEntry = library.entries.find((e) => e.id === activeLayoutId);
  const triggerName = activeEntry?.name ?? currentLayout.name;
  const triggerPreview = useMemo(
    () => activeEntry?.preview ?? computePreview(currentLayout),
    [activeEntry, currentLayout]
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleSwitch = useCallback(
    async (id: string) => {
      setOpen(false);
      if (id === activeLayoutId) return;
      await switchLayout(layoutId(id));
    },
    [activeLayoutId, switchLayout]
  );

  const handleNew = useCallback(async () => {
    setOpen(false);
    await createNewLayout();
  }, [createNewLayout]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        className="h-8 gap-1.5 px-1.5 text-content-secondary hover:bg-surface-hover hover:text-content"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('header.switchLayout', { name: triggerName })}
      >
        <Thumb preview={triggerPreview} size={30} className="h-6 w-8" />
        <Icon name="chevron" className="h-3.5 w-3.5" />
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 max-h-[70vh] w-64 overflow-auto rounded-lg border border-stroke bg-surface-elevated py-1 shadow-lg"
        >
          {library.entries.map((entry) => {
            const isActive = entry.id === activeLayoutId;
            return (
              <Button
                key={entry.id}
                variant="ghost"
                fullWidth
                role="menuitem"
                aria-current={isActive ? 'true' : undefined}
                onClick={() => void handleSwitch(entry.id)}
                className={`justify-start gap-2.5 rounded-none px-2.5 py-2 text-left text-sm font-normal hover:bg-surface-hover ${
                  isActive ? 'text-content' : 'text-content-secondary'
                }`}
              >
                <Thumb preview={entry.preview} size={38} className="h-8 w-10 flex-shrink-0" />
                <span className="min-w-0 flex-1 truncate" title={entry.name}>
                  {entry.name}
                </span>
                {isActive && <Icon name="check" className="h-4 w-4 flex-shrink-0 text-accent" />}
              </Button>
            );
          })}

          {library.entries.length > 0 && <div className="my-1 border-t border-stroke-subtle" />}

          <MenuAction onClick={() => void handleNew()}>
            <Icon name="plus" className="h-4 w-4" />
            {t('layouts.newLayout')}
          </MenuAction>

          <MenuAction
            onClick={() => {
              setOpen(false);
              onManage();
            }}
          >
            <Icon name="gear" className="h-4 w-4" />
            {t('header.manageLayouts')}
          </MenuAction>
        </div>
      )}
    </div>
  );
}
