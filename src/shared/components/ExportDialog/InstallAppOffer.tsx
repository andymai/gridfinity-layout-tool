import { useEffect, useState } from 'react';
import { Button, IconButton } from '@/design-system';
import { useTranslation } from '@/i18n';
import { trackPwaInstallOfferClosed, trackPwaInstallPromptShown } from '@/shared/analytics/posthog';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { useInstallPrompt } from '@/shared/hooks/useInstallPrompt';
import {
  canPromptInstall,
  closeInstallOffer,
  isInstallOfferClosed,
} from '@/shared/pwa/installPrompt';

export function InstallAppOffer() {
  const t = useTranslation();
  const { canInstall, install } = useInstallPrompt('export_success');
  // Decided once at mount, so the row does not pop in or out while the view is open.
  const [offered] = useState(() => canPromptInstall() && !isInstallOfferClosed());
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (offered) trackPwaInstallPromptShown('export_success');
  }, [offered]);

  if (!offered || closed || !canInstall) return null;

  const handleClose = () => {
    setClosed(true);
    closeInstallOffer();
    trackPwaInstallOfferClosed('export_success');
  };

  return (
    <div className="mt-4 flex w-full items-center gap-1">
      <Button
        variant="ghost"
        fullWidth
        onClick={() => void install()}
        className="h-auto justify-start gap-3 px-3 py-2 text-left"
        leftIcon={
          <svg
            className="h-5 w-5 shrink-0 text-content-secondary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            {ICON_PATHS.installApp.map((d) => (
              <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={d} />
            ))}
          </svg>
        }
      >
        <span className="flex flex-col">
          <span className="text-sm font-medium text-content">{t('pwaInstall.title')}</span>
          <span className="text-xs font-normal text-content-tertiary">
            {t('pwaInstall.description')}
          </span>
        </span>
      </Button>
      <IconButton
        variant="ghost"
        size="sm"
        onClick={handleClose}
        aria-label={t('pwaInstall.notNow')}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          {ICON_PATHS.close.map((d) => (
            <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
          ))}
        </svg>
      </IconButton>
    </div>
  );
}
