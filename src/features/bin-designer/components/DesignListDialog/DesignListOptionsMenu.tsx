import { useTranslation } from '@/i18n';
import { Menu } from '@/design-system';

interface DesignListOptionsMenuProps {
  open: boolean;
  position: { x: number; y: number };
  customDefaultActive: boolean;
  onClose: () => void;
  onSetDefault: () => void;
  onOpenTagManager: () => void;
  onResetFactory: () => void;
}

/** Overflow ("...") menu for new-bin default management and tag administration. */
export function DesignListOptionsMenu({
  open,
  position,
  customDefaultActive,
  onClose,
  onSetDefault,
  onOpenTagManager,
  onResetFactory,
}: DesignListOptionsMenuProps) {
  const t = useTranslation();

  return (
    <Menu.Root open={open} onClose={onClose} position={position} className="min-w-[18rem]">
      {customDefaultActive && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-content-tertiary"
          aria-hidden="true"
        >
          <span className="h-2 w-2 rounded-full bg-accent" />
          {t('binDesigner.customDefaultActive')}
        </div>
      )}
      <Menu.Item
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        }
        onClick={onSetDefault}
      >
        {t('binDesigner.setAsDefault')}
      </Menu.Item>
      <Menu.Item
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
        }
        onClick={onOpenTagManager}
      >
        {t('binDesigner.tagManager.menuItem')}
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        }
        disabled={!customDefaultActive}
        onClick={onResetFactory}
      >
        {t('binDesigner.resetFactoryDefaults')}
      </Menu.Item>
    </Menu.Root>
  );
}
