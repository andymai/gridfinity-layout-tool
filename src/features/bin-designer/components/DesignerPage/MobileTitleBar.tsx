/**
 * Compact title bar shown above the header on mobile/tablet viewports.
 * Displays app name and external links (Ko-fi tip jar, GitHub).
 */

import { useTranslation } from '@/i18n';
import { ICON_PATHS } from '@/shared/constants/iconPaths';

export function MobileTitleBar() {
  const t = useTranslation();
  return (
    <div className="h-7 flex items-center justify-between px-3 bg-surface border-b border-stroke-subtle">
      <span className="text-xs font-medium text-content-secondary">
        {t('toolSwitcher.gridfinityLayoutTool')}
      </span>
      <div className="flex items-center gap-3">
        <a
          href="https://ko-fi.com/andyaragon"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-accent hover:underline"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            {ICON_PATHS.heart.map((d) => (
              <path key={d} d={d} />
            ))}
          </svg>
          {t('sidebar.tip')}
        </a>
        <a
          href="https://github.com/andymai/gridfinity-layout-tool"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-content-tertiary hover:underline"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          {t('sidebar.github')}
        </a>
      </div>
    </div>
  );
}
