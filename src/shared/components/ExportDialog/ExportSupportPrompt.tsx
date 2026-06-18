/**
 * Post-export success view: confirms the download, then makes a low-pressure
 * support ask at the value-delivery moment. Below the Ko-fi tip sit two free
 * ways to help, each paired with the concrete impact it has — a GitHub star
 * (discoverability) and the r/gridfinity community (social proof).
 */

import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import { GITHUB_ICON_PATH, ICON_PATHS, REDDIT_ICON_PATH } from '@/shared/constants/iconPaths';
import { GITHUB_REPO_URL, KOFI_URL, REDDIT_GRIDFINITY_URL } from '@/shared/constants/links';

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

  const handleReddit = () => {
    trackEvent('reddit_link_clicked', { source });
    window.open(REDDIT_GRIDFINITY_URL, '_blank', 'noopener,noreferrer');
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

      <p className="mt-4 self-start text-xs font-medium text-content-tertiary">
        {t('export.support.freeWays')}
      </p>

      <Button
        variant="ghost"
        fullWidth
        onClick={handleGithub}
        title={t('header.starOnGithub')}
        className="mt-2 h-auto justify-start gap-3 px-3 py-2 text-left"
        leftIcon={
          <svg
            className="h-5 w-5 shrink-0 text-content-secondary"
            fill="currentColor"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path d={GITHUB_ICON_PATH} />
          </svg>
        }
      >
        <span className="flex flex-col">
          <span className="text-sm font-medium text-content">{t('export.support.starGithub')}</span>
          <span className="text-xs font-normal text-content-tertiary">
            {t('export.support.githubImpact')}
          </span>
        </span>
      </Button>

      <Button
        variant="ghost"
        fullWidth
        onClick={handleReddit}
        title={t('common.redditCommunityAria')}
        className="mt-2 h-auto justify-start gap-3 px-3 py-2 text-left"
        leftIcon={
          <svg className="h-5 w-5 shrink-0" fill="#FF4500" viewBox="0 0 24 24" aria-hidden="true">
            <path d={REDDIT_ICON_PATH} />
          </svg>
        }
      >
        <span className="flex flex-col">
          <span className="text-sm font-medium text-content">{t('common.redditCommunity')}</span>
          <span className="text-xs font-normal text-content-tertiary">
            {t('export.support.redditImpact')}
          </span>
        </span>
      </Button>

      <Button variant="secondary" fullWidth onClick={onDone} className="mt-5">
        {t('common.done')}
      </Button>
    </div>
  );
}
