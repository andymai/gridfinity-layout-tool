/**
 * Post-export success view: confirms the download, then makes a low-pressure
 * support ask at the value-delivery moment, with a free "star on GitHub"
 * fallback for people who won't tip.
 */

import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { GITHUB_REPO_URL, KOFI_URL } from '@/shared/constants/links';

export interface ExportSupportPromptProps {
  /** Resolved download filename, shown in the confirmation line. */
  fileName: string;
  /** Close the dialog. */
  onDone: () => void;
  /** Analytics source tag, e.g. 'bin_designer_export' / 'baseplate_export'. */
  source: string;
}

export function ExportSupportPrompt({ fileName, onDone, source }: ExportSupportPromptProps) {
  const t = useTranslation();

  const handleKofi = () => {
    trackEvent('kofi_clicked', { source });
    window.open(KOFI_URL, '_blank', 'noopener,noreferrer');
  };

  const handleGithub = () => {
    trackEvent('github_link_clicked', { source });
    window.open(GITHUB_REPO_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col items-center px-2 pb-2 pt-2 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success-muted">
        <svg
          className="h-6 w-6 text-success"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          {ICON_PATHS.check.map((d) => (
            <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={d} />
          ))}
        </svg>
      </div>

      <p className="text-sm font-medium text-content">
        {t('export.support.downloading', { fileName })}
      </p>

      <div className="my-4 h-px w-full bg-stroke-subtle" />

      <p className="mb-3 text-sm text-content-secondary">{t('export.support.pitch')}</p>

      <Button
        variant="primary"
        fullWidth
        onClick={handleKofi}
        leftIcon={
          <img
            src="/kofi-cup.png"
            alt=""
            aria-hidden="true"
            className="kofi-cup-wiggle h-4 w-auto"
          />
        }
        className="leading-none"
        style={{ color: '#fff', textShadow: '0 1px 1px rgba(34, 34, 34, 0.15)' }}
      >
        {t('header.supportOnKofi')}
      </Button>

      <Button
        variant="ghost"
        onClick={handleGithub}
        className="mt-3 h-auto rounded-none bg-transparent px-0 py-0 text-xs font-normal text-content-tertiary underline-offset-2 hover:bg-transparent hover:text-content hover:underline"
      >
        {t('export.support.starGithub')}
      </Button>

      <Button variant="secondary" fullWidth onClick={onDone} className="mt-5">
        {t('common.done')}
      </Button>
    </div>
  );
}
