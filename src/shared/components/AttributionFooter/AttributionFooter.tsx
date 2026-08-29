import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { KOFI_URL } from '@/shared/constants/links';
import { useTranslation } from '@/i18n';
import { useSupportersRouting } from '@/shared/hooks/useSupportersRouting';
import { AppVersionButton } from '@/shared/components/AppVersionButton';

export function AttributionFooter() {
  const t = useTranslation();
  const { navigateToSupporters } = useSupportersRouting();
  return (
    <div className="px-4 py-4 border-t border-stroke-subtle text-content-tertiary text-micro leading-relaxed">
      <div className="text-content-secondary text-label font-semibold mb-1 flex items-baseline gap-1.5">
        {t('sidebar.appName')}
        <AppVersionButton />
      </div>
      {t('sidebar.gridfinityBy')}{' '}
      <a
        href="https://www.youtube.com/c/ZackFreedman"
        target="_blank"
        rel="noopener noreferrer"
        className="text-content-secondary hover:underline"
      >
        Zack Freedman
      </a>
      <br />
      {t('sidebar.toolBy')}{' '}
      <a
        href="https://www.linkedin.com/in/andyhmai/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-content-secondary hover:underline"
      >
        Andy Aragon
      </a>{' '}
      ·{' '}
      <a
        href={KOFI_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent hover:underline"
      >
        <svg
          className="w-3 h-3 inline-block align-text-bottom mr-0.5"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          {ICON_PATHS.heart.map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
        {t('sidebar.tip')}
      </a>{' '}
      ·{' '}
      <a
        href="/supporters"
        onClick={(e) => {
          // Preserve Cmd/Ctrl/Shift-click (open in new tab/window); only
          // intercept a plain left-click for in-app SPA navigation.
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          navigateToSupporters();
        }}
        className="text-content-secondary hover:underline"
      >
        {t('sidebar.supporters')}
      </a>{' '}
      ·{' '}
      <a
        href="/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="text-content-secondary hover:underline"
      >
        {t('sidebar.privacy')}
      </a>{' '}
      ·{' '}
      <a
        href="/terms"
        target="_blank"
        rel="noopener noreferrer"
        className="text-content-secondary hover:underline"
      >
        {t('sidebar.terms')}
      </a>
    </div>
  );
}
