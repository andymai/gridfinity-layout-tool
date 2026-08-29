import { useShallow } from 'zustand/react/shallow';
import { Button, Tooltip } from '@/design-system';
import { cn } from '@/design-system/cn';
import { usePWAUpdateStore } from '@/core/store/pwaUpdate';
import { useViewStore } from '@/core/store/view';
import { hasUnseen, useSeenState } from '@/features/whats-new';
import { useTranslation } from '@/i18n';

/**
 * The version line's three states, in priority order. A pending update and
 * unseen highlights can both be true at once, so the slot renders only the
 * higher-priority one and the two signals never compete for the same glance.
 * In practice they rarely overlap, since reloading is what turns `update`
 * into `unseen`.
 */
type VersionState = 'update' | 'unseen' | 'idle';

function useVersionState(): VersionState {
  const updateReady = usePWAUpdateStore((state) => state.updateReady);
  const unseen = hasUnseen(useSeenState());
  if (updateReady) return 'update';
  return unseen ? 'unseen' : 'idle';
}

interface AppVersionButtonProps {
  /** Centers the chip under a centered heading, for the mobile panel. */
  align?: 'start' | 'center';
  /** Runs before navigating away, e.g. to close the panel the button sits in. */
  onBeforeAction?: () => void;
}

export function AppVersionButton({ align = 'start', onBeforeAction }: AppVersionButtonProps) {
  const t = useTranslation();
  const state = useVersionState();
  const applyUpdate = usePWAUpdateStore((s) => s.applyUpdate);
  const setWhatsNewOpen = useViewStore((s) => s.setWhatsNewOpen);

  const handleClick = (): void => {
    onBeforeAction?.();
    if (state === 'update' && applyUpdate) {
      applyUpdate();
      return;
    }
    setWhatsNewOpen(true);
  };

  const tooltip = state === 'update' ? t('pwaUpdate.readyTooltip') : t('whatsNew.openTooltip');

  return (
    <Tooltip content={tooltip} placement="top">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        aria-label={state === 'update' ? t('pwaUpdate.reloadAria') : t('whatsNew.open')}
        className={cn(
          'h-auto gap-1.5 px-0 text-micro font-normal text-content-disabled',
          'hover:bg-transparent hover:text-content-tertiary',
          align === 'center' && 'justify-center'
        )}
      >
        <span className="tabular-nums underline-offset-2 hover:underline">
          {t('sidebar.version', { version: __APP_VERSION__ })}
        </span>
        {state !== 'idle' && (
          <span
            className={cn(
              'rounded-full border px-1.5 text-micro font-semibold uppercase tracking-wide',
              'border-accent/40 bg-accent/10 text-accent'
            )}
          >
            {state === 'update' ? t('pwaUpdate.reload') : t('whatsNew.badge')}
          </span>
        )}
      </Button>
    </Tooltip>
  );
}

/**
 * Collapsed-rail equivalent. The 48px rail has no footer to carry a chip, and
 * someone working in it is precisely the person who will never see one.
 */
export function AppVersionRailButton() {
  const t = useTranslation();
  const state = useVersionState();
  const { applyUpdate } = usePWAUpdateStore(useShallow((s) => ({ applyUpdate: s.applyUpdate })));
  const setWhatsNewOpen = useViewStore((s) => s.setWhatsNewOpen);

  if (state === 'idle') return null;

  const isUpdate = state === 'update';

  return (
    <Tooltip
      content={isUpdate ? t('pwaUpdate.readyTooltip') : t('whatsNew.openTooltip')}
      placement="right"
    >
      <Button
        iconOnly
        size="sm"
        variant="ghost"
        aria-label={isUpdate ? t('pwaUpdate.reloadAria') : t('whatsNew.open')}
        onClick={() => {
          if (isUpdate && applyUpdate) {
            applyUpdate();
            return;
          }
          setWhatsNewOpen(true);
        }}
        className="border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={isUpdate ? 'M13 2 3 14h8l-1 8 10-12h-8l1-8z' : 'M12 4v16m8-8H4'}
          />
        </svg>
      </Button>
    </Tooltip>
  );
}
