/**
 * Post-export success view: confirms the download, then makes a low-pressure
 * support ask at the value-delivery moment. Below the Ko-fi tip sit two free
 * ways to help, each paired with the concrete impact it has — a GitHub star
 * (discoverability) and the r/gridfinity community (social proof).
 */

import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { GITHUB_REPO_URL, KOFI_URL, REDDIT_GRIDFINITY_URL } from '@/shared/constants/links';

const GITHUB_ICON_PATH =
  'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z';

const REDDIT_ICON_PATH =
  'M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.986 0 1.787.802 1.787 1.788 0 .722-.43 1.349-1.052 1.627-.026.207-.04.417-.04.63 0 3.226-3.76 5.838-8.397 5.838-4.638 0-8.397-2.612-8.397-5.838 0-.214-.014-.425-.04-.633-.62-.278-1.05-.904-1.05-1.624 0-.986.8-1.788 1.787-1.788.474 0 .906.19 1.222.494 1.197-.857 2.849-1.418 4.69-1.488l.892-4.205a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z';

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
        title={t('header.redditCommunityAria')}
        className="mt-2 h-auto justify-start gap-3 px-3 py-2 text-left"
        leftIcon={
          <svg className="h-5 w-5 shrink-0" fill="#FF4500" viewBox="0 0 24 24" aria-hidden="true">
            <path d={REDDIT_ICON_PATH} />
          </svg>
        }
      >
        <span className="flex flex-col">
          <span className="text-sm font-medium text-content">{t('header.redditCommunity')}</span>
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
