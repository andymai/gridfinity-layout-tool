/**
 * The design is what the user is actually publishing, so it leads the dialog
 * rather than sitting in an 80px scroll strip. Captures already arrive as
 * several angles, so the extra angles become a selectable strip instead of
 * being rendered at a size nobody can judge.
 */

import { useState } from 'react';
import { Alert, Button, Spinner, cn } from '@/design-system';
import { useTranslation } from '@/i18n';

export interface PublishPreviewProps {
  thumbnails: readonly string[] | null;
  captureFailed: boolean;
  onRetry: () => void;
}

function thumbnailSrc(value: string): string {
  return value.startsWith('data:') ? value : `data:image/webp;base64,${value}`;
}

export function PublishPreview({ thumbnails, captureFailed, onRetry }: PublishPreviewProps) {
  const t = useTranslation();
  const [angle, setAngle] = useState(0);

  const count = thumbnails?.length ?? 0;

  if (captureFailed) {
    return (
      <Alert intent="warning" size="md" title={t('community.publish.form.previewFailed')}>
        <div className="mt-2">
          <Button variant="secondary" className="min-h-11 md:min-h-0" onClick={onRetry}>
            {t('community.publish.form.retryPreview')}
          </Button>
        </div>
      </Alert>
    );
  }

  if (thumbnails === null || count === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center gap-3 rounded-lg border border-stroke-subtle bg-surface-hover">
        <Spinner />
        <span className="text-sm text-content-secondary">
          {t('community.publish.form.preparingPreview')}
        </span>
      </div>
    );
  }

  // Clamped rather than corrected in an effect: a recapture can return fewer
  // angles than the selected index.
  const active = Math.min(angle, count - 1);

  return (
    <div className="space-y-2">
      <img
        src={thumbnailSrc(thumbnails[active])}
        alt={t('community.publish.form.previewAlt', { index: active + 1 })}
        className="aspect-[4/3] w-full rounded-lg border border-stroke-subtle bg-surface-hover object-contain"
      />
      {count > 1 && (
        <div
          role="group"
          aria-label={t('community.publish.form.anglesLabel')}
          className="flex items-center gap-2"
        >
          {thumbnails.map((thumb, index) => (
            <Button
              key={index}
              variant="ghost"
              aria-pressed={index === active}
              aria-label={t('community.publish.form.angleSelect', { index: index + 1 })}
              className={cn(
                'h-14 w-14 overflow-hidden rounded-md border !px-0 py-0',
                index === active
                  ? 'border-accent ring-1 ring-accent'
                  : 'border-stroke-subtle opacity-70 hover:opacity-100'
              )}
              onClick={() => setAngle(index)}
            >
              <img src={thumbnailSrc(thumb)} alt="" className="h-full w-full object-cover" />
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
