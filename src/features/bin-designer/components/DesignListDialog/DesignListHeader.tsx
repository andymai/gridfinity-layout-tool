import type { MouseEvent as ReactMouseEvent } from 'react';
import type { ItemKind } from '@/shared/types/item';
import { useTranslation } from '@/i18n';
import { Button, IconButton, XIcon } from '@/design-system';

interface DesignListHeaderProps {
  showSelectButton: boolean;
  optionsMenuOpen: boolean;
  customDefaultActive: boolean;
  onEnterSelect: () => void;
  onShowImport: () => void;
  onNewDesign: (kind?: ItemKind) => void;
  showWorkshopButton: boolean;
  onOpenOptionsMenu: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  onClose: () => void;
}

/** Header bar for the design list dialog: title plus select/import/new/options/close controls. */
export function DesignListHeader({
  showSelectButton,
  optionsMenuOpen,
  customDefaultActive,
  onEnterSelect,
  onShowImport,
  onNewDesign,
  showWorkshopButton,
  onOpenOptionsMenu,
  onClose,
}: DesignListHeaderProps) {
  const t = useTranslation();

  return (
    <div className="flex items-center justify-between border-b border-stroke-subtle px-5 py-4">
      <h2 className="text-lg font-semibold text-content">{t('binDesigner.savedDesigns')}</h2>
      <div className="flex flex-wrap items-center gap-2">
        {showSelectButton && (
          <Button
            variant="secondary"
            onClick={onEnterSelect}
            className="rounded-md bg-surface-secondary px-3 py-1.5 text-sm font-medium text-content border border-stroke transition-colors hover:bg-surface-hover"
          >
            {t('binDesigner.select')}
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={onShowImport}
          className="rounded-md bg-surface-secondary px-3 py-1.5 text-sm font-medium text-content border border-stroke transition-colors hover:bg-surface-hover"
        >
          {t('common.import')}
        </Button>
        {showWorkshopButton && (
          <Button
            variant="secondary"
            onClick={() => onNewDesign('assembly')}
            className="rounded-md px-3 py-1.5 text-sm font-medium"
          >
            {t('binDesigner.newWorkshop')}
          </Button>
        )}
        <Button
          variant="primary"
          onClick={() => onNewDesign()}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
        >
          {t('binDesigner.newDesign')}
        </Button>
        <IconButton
          type="button"
          size="md"
          touchTarget={false}
          onClick={onOpenOptionsMenu}
          className="relative h-auto w-auto rounded-md p-1.5 text-content-secondary border border-stroke transition-colors hover:bg-surface-hover hover:text-content"
          aria-label={
            customDefaultActive
              ? `${t('binDesigner.moreOptions')} — ${t('binDesigner.customDefaultActive')}`
              : t('binDesigner.moreOptions')
          }
          aria-haspopup="menu"
          aria-expanded={optionsMenuOpen}
          title={t('binDesigner.moreOptions')}
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 5v.01M12 12v.01M12 19v.01"
            />
          </svg>
          {customDefaultActive && (
            <span
              className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-accent ring-2 ring-surface-secondary"
              aria-hidden="true"
            />
          )}
        </IconButton>
        <IconButton
          size="sm"
          touchTarget={false}
          onClick={onClose}
          className="h-auto w-auto rounded-md p-1 text-content-secondary hover:bg-surface-hover hover:text-content"
          aria-label={t('common.close')}
        >
          <XIcon className="h-5 w-5" />
        </IconButton>
      </div>
    </div>
  );
}
