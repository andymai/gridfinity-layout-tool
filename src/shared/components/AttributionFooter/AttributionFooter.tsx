import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { useTranslation } from '@/i18n';
import { useSupportersRouting } from '@/shared/hooks/useSupportersRouting';

export function AttributionFooter() {
  const t = useTranslation();
  const { navigateToSupporters } = useSupportersRouting();
  return (
    <div className="px-4 py-4 border-t border-stroke-subtle text-content-disabled text-[10px] leading-relaxed">
      <div className="text-content-secondary text-[11px] font-semibold mb-1 flex items-baseline gap-1.5">
        {t('sidebar.appName')}
        <a
          href="https://github.com/andymai/gridfinity-layout-tool/releases"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-normal text-content-disabled hover:text-content-tertiary hover:underline"
        >
          {t('sidebar.version', { version: __APP_VERSION__ })}
        </a>
      </div>
      {t('sidebar.gridfinityBy')}{' '}
      <a
        href="https://www.youtube.com/c/ZackFreedman"
        target="_blank"
        rel="noopener noreferrer"
        className="text-content-tertiary hover:underline"
      >
        Zack Freedman
      </a>
      <br />
      {t('sidebar.toolBy')}{' '}
      <a
        href="https://www.linkedin.com/in/andyhmai/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-content-tertiary hover:underline"
      >
        Andy Aragon
      </a>{' '}
      ·{' '}
      <a
        href="https://ko-fi.com/andyaragon"
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
        className="text-content-tertiary hover:underline"
      >
        {t('sidebar.supporters')}
      </a>{' '}
      ·{' '}
      <a
        href="/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="text-content-tertiary hover:underline"
      >
        {t('sidebar.privacy')}
      </a>{' '}
      ·{' '}
      <a
        href="/terms"
        target="_blank"
        rel="noopener noreferrer"
        className="text-content-tertiary hover:underline"
      >
        {t('sidebar.terms')}
      </a>
    </div>
  );
}
