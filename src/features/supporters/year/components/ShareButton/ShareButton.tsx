import { IconButton } from '@/design-system';
import { useTranslation } from '@/i18n';
import { triggerDownload } from '@/shared/generation/exportUtils';

const SAVE_ICON = 'M12 4v11m0 0l-4-4m4 4l4-4M5 19h14';

export interface ShareButtonProps {
  /** Null until the card's image is ready; the button waits for it. */
  readonly blob: Blob | null;
  readonly fileName: string;
}

/** The phone share sheet where the browser can share a file, else a download. */
export function ShareButton({ blob, fileName }: ShareButtonProps) {
  const t = useTranslation();
  const label = t('your2026.controls.save');

  const save = () => {
    if (!blob) return;
    const file = new File([blob], fileName, { type: 'image/png' });
    if ('canShare' in navigator && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file] }).catch(() => undefined);
      return;
    }
    triggerDownload(blob, fileName);
  };

  return (
    <IconButton
      size="sm"
      variant="ghost"
      aria-label={label}
      title={label}
      disabled={!blob}
      onClick={save}
      className="text-white/80 hover:text-white"
    >
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={SAVE_ICON} />
      </svg>
    </IconButton>
  );
}
