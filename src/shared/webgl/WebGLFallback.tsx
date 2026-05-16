import { useEffect } from 'react';
import { useTranslation } from '@/i18n';
import { track3DRenderError } from '@/shared/analytics/posthog';
import type { WebGLUnavailableReason } from './detectWebGL';

interface WebGLFallbackProps {
  reason: WebGLUnavailableReason;
  component: string;
}

const HELP_URL = 'https://get.webgl.org/';

export function WebGLFallback({ reason, component }: WebGLFallbackProps) {
  const t = useTranslation();

  useEffect(() => {
    track3DRenderError(component, `webgl-unavailable:${reason}`);
  }, [component, reason]);

  return (
    <div
      className="flex h-full min-h-[200px] w-full flex-col items-center justify-center p-6 text-center"
      role="alert"
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-error/20">
        <svg
          className="h-6 w-6 text-error"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h3 className="mb-1 text-sm font-medium text-content">{t('webgl.fallback.title')}</h3>
      <p className="mb-3 max-w-[280px] text-xs text-content-secondary">
        {t('webgl.fallback.body')}
      </p>
      <a
        href={HELP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded bg-surface-secondary px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-elevated"
      >
        {t('webgl.fallback.helpLink')}
      </a>
    </div>
  );
}
